import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import config from './sync.config.js';
import { listen } from './barcodeScanner.js';
import USBScannerListener from './usbScanner.js';
import {
  saveScan,
  getPendingScans,
  markAsSynced,
  markAsRejected,
  getTodaySales,
  upsertProducts,
  getProductByBarcode,
  listProducts,
  updateProductImage,
  updateScanPrice,
} from './db.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const IMAGE_DIR = path.join(process.cwd(), 'public', 'images');
fs.mkdirSync(IMAGE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${req.params.barcode}${safeExt}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten archivos de imagen'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
});

app.use(cors());
app.use(express.json());
app.use('/images', express.static(IMAGE_DIR));

let syncing = false;
let pendingVariablePriceScan = null;
const todaySales = [];
const productCache = new Map();

function buildImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  const normalized = imagePath.replace(/^[\\/]+/, '').replace(/\\/g, '/');
  return `/${normalized}`;
}

function getCachedProduct(barcode) {
  if (productCache.has(barcode)) {
    return productCache.get(barcode);
  }
  const product = getProductByBarcode(barcode);
  if (product) {
    productCache.set(barcode, product);
  }
  return product;
}

function mapProductToDto(product) {
  if (!product) return null;
  return {
    barcode: product.barcode,
    name: product.name,
    category: product.category,
    pricingMode: product.pricing_mode ?? product.pricingMode,
    defaultPriceCents: product.default_price_cents ?? null,
    sourceType: product.source_type ?? product.sourceType,
    active: product.active === 0 ? false : true,
    imageUrl: buildImageUrl(product.image_path ?? null),
  };
}

async function loadProductCatalog() {
  const endpoint = config.catalogEndpoint || '/products';
  const base = config.apiBase.replace(/\/$/, '');
  const catalogUrl = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
  try {
    const headers = {};
    if (config.jwt) headers.Authorization = `Bearer ${config.jwt}`;
    const { data } = await axios.get(catalogUrl, { headers, timeout: 5000 });
    if (!Array.isArray(data)) {
      console.warn('Catálogo recibido en formato inesperado');
      return;
    }

    const normalized = data
      .filter((item) => item && item.barcode)
      .map((item) => {
        const rawPrice = item.defaultPriceCents ?? item.default_price_cents ?? null;
        const defaultPriceCents = rawPrice == null ? null : Math.round(Number(rawPrice) * 1000);

        return {
          barcode: item.barcode,
          name: item.name || item.description || item.barcode,
          category: item.category || 'varios',
          pricingMode: item.pricingMode || item.pricing_mode || 'fixed',
          defaultPriceCents,
          sourceType: item.sourceType ?? item.source_type ?? 'compra',
          active: item.active !== false,
          imagePath: item.imagePath ?? item.image_path ?? null,
          updatedAt: item.updatedAt ?? item.updated_at ?? new Date().toISOString(),
        };
      });

    if (!normalized.length) return;

    upsertProducts(normalized);
    productCache.clear();
    for (const product of normalized) {
      const stored = getProductByBarcode(product.barcode);
      if (stored) productCache.set(product.barcode, stored);
    }
    io.emit('products-refreshed', listProducts().map(mapProductToDto));
    console.log(`📦 Catálogo actualizado: ${normalized.length} productos.`);
  } catch (error) {
    console.error('Error cargando catálogo:', error.message);
  }
}

// Middleware para logs
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Endpoint para obtener ventas del día
app.get('/api/sales/today', (req, res) => {
  const sales = getTodaySales();
  const summary = {
    totalItems: sales.reduce((sum, s) => sum + (s.quantity || 1), 0),
    totalCents: sales.reduce((sum, s) => sum + (s.price_cents || 0), 0),
    sales: sales.map((s) => {
      const product = getCachedProduct(s.barcode);
      return {
        id: s.id,
        barcode: s.barcode,
        productName: s.product_name || product?.name || 'Producto desconocido',
        category: s.category || product?.category || null,
        priceCents: s.price_cents ?? product?.default_price_cents ?? null,
        quantity: s.quantity || 1,
        scannedAt: s.scanned_at,
        status: s.status,
        imageUrl: buildImageUrl(s.image_path || product?.image_path),
      };
    }),
  };
  res.json(summary);
});

// Endpoint para obtener scan pendiente de precio variable
app.get('/api/pending-variable-price', (req, res) => {
  res.json(pendingVariablePriceScan || null);
});

// Endpoint para recibir códigos de barras vía HTTP (alternativa al stdin)
app.get('/api/products', (_req, res) => {
  const products = listProducts().map(mapProductToDto);
  res.json(products);
});

app.post('/api/products/:barcode/image', upload.single('image'), (req, res, next) => {
  try {
    const { barcode } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'Archivo de imagen requerido' });
    }

    const product = getCachedProduct(barcode);
    if (!product) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const relativePath = path.join('images', req.file.filename).replace(/\\/g, '/');
    updateProductImage(barcode, relativePath);
    productCache.set(barcode, getProductByBarcode(barcode));

    const dto = mapProductToDto(productCache.get(barcode));
    io.emit('product-updated', dto);
    res.json({ success: true, product: dto });
  } catch (error) {
    next(error);
  }
});
app.post('/api/scan', (req, res) => {
  const { barcode } = req.body;
  
  if (!barcode || typeof barcode !== 'string' || barcode.trim().length === 0) {
    return res.status(400).json({ error: 'Código de barras inválido' });
  }

  console.log(`📥 Código recibido vía HTTP: ${barcode}`);
  addScan(barcode.trim());
  res.json({ success: true, barcode: barcode.trim() });
});

// Endpoint para enviar precio variable
app.post('/api/set-variable-price', async (req, res) => {
  const { scanId, priceCents } = req.body;
  
  if (!scanId || typeof priceCents !== 'number' || priceCents <= 0) {
    return res.status(400).json({ error: 'scanId y priceCents válidos requeridos' });
  }

  if (!pendingVariablePriceScan || pendingVariablePriceScan.id !== scanId) {
    return res.status(404).json({ error: 'Scan no encontrado o ya procesado' });
  }

  try {
    // Enviar el precio al backend
    const headers = { 'Content-Type': 'application/json' };
    if (config.jwt) headers.Authorization = `Bearer ${config.jwt}`;

    const payload = {
      scans: [{
        id: pendingVariablePriceScan.id,
        barcode: pendingVariablePriceScan.barcode,
        deviceId: pendingVariablePriceScan.deviceId,
        scannedAt: pendingVariablePriceScan.scannedAt,
        variablePriceCents: priceCents
      }]
    };

    const { data } = await axios.post(
      `${config.apiBase}/scans/bulk`,
      payload,
      { headers, timeout: 5000 }
    );

    const accepted = new Set(data.acceptedIds || []);
    const rejected = data.rejected || [];

        if (accepted.has(scanId)) {
      const syncedAt = new Date().toISOString();
      markAsSynced([scanId], syncedAt);
      updateScanPrice(scanId, priceCents);
      const product = getCachedProduct(pendingVariablePriceScan.barcode);

      const sale = {
        ...pendingVariablePriceScan,
        productName: pendingVariablePriceScan.productName || product?.name || 'Producto desconocido',
        category: pendingVariablePriceScan.category || product?.category || 'varios',
        priceCents,
        status: 'synced',
        imageUrl: pendingVariablePriceScan.imageUrl || buildImageUrl(product?.image_path),
      };

      io.emit('sale-completed', sale);
      console.log(`?? Venta con precio variable: ${(priceCents / 100).toFixed(2)}`);

      pendingVariablePriceScan = null;
      res.json({ success: true, sale });
    } else {
      const rejection = rejected.find(r => r.id === scanId);
      markAsRejected(scanId);
      pendingVariablePriceScan = null;
      res.status(400).json({ error: rejection?.reason || 'Rechazado por el servidor' });
    }
  } catch (error) {
    console.error('Error enviando precio variable:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Función para procesar escaneo
function addScan(barcode) {
  const product = getCachedProduct(barcode);
  const pricingMode = product?.pricing_mode ?? product?.pricingMode;
  const priceForFixed = pricingMode === 'fixed' ? (product?.default_price_cents ?? null) : null;
  const imagePath = product?.image_path ?? null;

  const scan = {
    id: uuid(),
    barcode,
    deviceId: config.deviceId,
    scannedAt: new Date().toISOString(),
    productName: product?.name ?? null,
    category: product?.category ?? null,
    priceCents: priceForFixed,
    imagePath,
  };

  saveScan(scan);
  console.log(`\n?? Lectura registrada: ${barcode}`);
  console.log(`   ID: ${scan.id}`);
  console.log(`   Timestamp: ${scan.scannedAt}\n`);

  console.log('?? Emitiendo evento "scan-received" al frontend...');
  io.emit('scan-received', { ...scan, imageUrl: buildImageUrl(imagePath) });

  console.log('?? Iniciando sincronizaci�n con backend...');
  triggerSync();
}

async function triggerSync() {
  if (syncing) {
    console.log('⏳ Sincronización ya en curso, esperando...');
    return;
  }
  const pending = getPendingScans();
  if (pending.length === 0) {
    console.log('✓ No hay scans pendientes de sincronizar');
    return;
  }

  console.log(`📤 Sincronizando ${pending.length} scan(s) pendiente(s)...`);
  syncing = true;
  try {
    const payload = {
      scans: pending.map((scan) => ({
        id: scan.id,
        barcode: scan.barcode,
        deviceId: scan.device_id,
        scannedAt: scan.scanned_at,
      })),
    };

    const headers = { 'Content-Type': 'application/json' };
    if (config.jwt) headers.Authorization = `Bearer ${config.jwt}`;

    const { data } = await axios.post(
      `${config.apiBase}/scans/bulk`,
      payload,
      { headers, timeout: 5000 },
    );

    // 🔍 LOG DETALLADO DE LA RESPUESTA DEL BACKEND
    console.log('📡 Respuesta del backend:', JSON.stringify(data, null, 2));

    const accepted = new Set(data.acceptedIds || []);
    const rejected = data.rejected || [];
    const variablePriceRequired = data.variablePriceRequired || [];    if (accepted.size) {
      const syncedAt = new Date().toISOString();
      markAsSynced([...accepted], syncedAt);
      persistAccepted([...accepted], pending);
      console.log(`?? Enviados: ${accepted.size}`);

      for (const id of accepted) {
        const scan = pending.find((s) => s.id === id);
        if (!scan) continue;

        const product = getCachedProduct(scan.barcode);
        const imagePath = scan.image_path || product?.image_path || null;
        const computedPrice =
          scan.price_cents ?? product?.default_price_cents ?? null;

        if (computedPrice != null && scan.price_cents == null) {
          updateScanPrice(scan.id, computedPrice);
        }

        io.emit('sale-completed', {
          id: scan.id,
          barcode: scan.barcode,
          productName: scan.product_name || product?.name || 'Producto desconocido',
          category: scan.category || product?.category || 'varios',
          priceCents: computedPrice,
          quantity: scan.quantity || 1,
          scannedAt: scan.scanned_at,
          status: 'synced',
          imageUrl: buildImageUrl(imagePath),
        });
      }
    }

    // Manejar productos' que requieren precio variable
    for (const item of variablePriceRequired) {
      const scan = pending.find((s) => s.id === item.id);
      if (scan) {
        const product = getCachedProduct(scan.barcode);
                pendingVariablePriceScan = {
          id: scan.id,
          barcode: scan.barcode,
          deviceId: scan.device_id,
          scannedAt: scan.scanned_at,
          productName: product?.name || item.productName || 'Varios',
          category: product?.category || item.category || 'varios',
          imageUrl: buildImageUrl(product?.image_path || scan.image_path),
        };
        
        io.emit('variable-price-required', pendingVariablePriceScan);
        console.log(`⚠️  Precio variable requerido para: ${pendingVariablePriceScan.productName}`);
      }
    }

    for (const rej of rejected) {
      markAsRejected(rej.id);
      persistRejected(rej);
      console.warn(`✖ Rechazado ${rej.id}: ${rej.reason}`);
      
      io.emit('sale-rejected', {
        id: rej.id,
        reason: rej.reason
      });
    }
  } catch (error) {
    console.error('Error sincronizando:', error.message);
    io.emit('sync-error', { message: error.message });
  } finally {
    syncing = false;
  }
}

function persistAccepted(ids, payloadScans) {
  const lines = payloadScans
    .filter((scan) => ids.includes(scan.id))
    .map((scan) => JSON.stringify({
      ...scan,
      syncedAt: new Date().toISOString(),
    }));

  if (lines.length === 0) return;

  fs.appendFileSync('./synced.log', lines.join('\n') + '\n');
}

function persistRejected(reject) {
  fs.appendFileSync(
    './rejected.log',
    `${new Date().toISOString()} ${reject.id} ${reject.reason}\n`,
  );
}

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
  
  // Enviar resumen actual al conectar
  const sales = getTodaySales();
  socket.emit('initial-data', {
    sales: sales.map((s) => {
      const product = getCachedProduct(s.barcode);
      return {
        id: s.id,
        barcode: s.barcode,
        productName: s.product_name || product?.name || 'Producto desconocido',
        category: s.category || product?.category || null,
        priceCents: s.price_cents ?? product?.default_price_cents ?? null,
        quantity: s.quantity || 1,
        scannedAt: s.scanned_at,
        status: s.status,
        imageUrl: buildImageUrl(s.image_path || product?.image_path),
      };
    }),
    pendingVariablePrice: pendingVariablePriceScan,
    products: listProducts().map(mapProductToDto),
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});


app.use((err, _req, res, _next) => {
  console.error(`Error en la solicitud: ${err.message}`);
  const status = err instanceof multer.MulterError ? 400 : 500;
  res.status(status).json({ error: err.message });
});

loadProductCatalog();
if (config.catalogRefreshMs) {
  setInterval(loadProductCatalog, config.catalogRefreshMs);
}

// Iniciar servidor
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║  🚀 Servidor de Inventario Iniciado      ║
║                                           ║
║  Puerto: ${PORT}                            ║
║  WebSocket: Activo                        ║
║  Escáner: Listo                          ║
╚═══════════════════════════════════════════╝
  `);
  
  // Iniciar escáner de códigos (stdin - método tradicional)
  listen(addScan);
  
  // Si está en Linux y se especifica un dispositivo USB, usar listener directo
  const usbDevice = process.env.USB_SCANNER_DEVICE;
  if (usbDevice && process.platform === 'linux') {
    console.log(`� Iniciando listener USB directo: ${usbDevice}`);
    const usbListener = new USBScannerListener(usbDevice);
    usbListener.on('scan', addScan);
    usbListener.on('error', (err) => {
      console.error('⚠️  Error en USB listener:', err.message);
      console.log('💡 Continuando con método stdin...');
    });
    usbListener.start();
  } else {
    console.log('💡 Para usar USB directo, ejecuta con:');
    console.log('   USB_SCANNER_DEVICE=/dev/input/event0 node server.js');
  }
  
  console.log('');
  
  // Sincronización periódica
  setInterval(triggerSync, config.syncIntervalMs);
  triggerSync();
});











