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
    methods: ['GET', 'POST'],
  },
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
  limits: { fileSize: 4 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());
app.use('/images', express.static(IMAGE_DIR));

let syncing = false;
let pendingVariablePriceScan = null;
const productCache = new Map();
const PRICE_SCALE = 1000;

function toRemotePrice(value) {
  if (value == null) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return Math.round(numeric * PRICE_SCALE);
}

function broadcastSale(scan, product = null, statusOverride = null) {
  const dto = mapScanToClient(
    {
      ...scan,
      status: statusOverride || scan.status || 'pending',
    },
    product,
  );
  io.emit('sale-updated', dto);
  return dto;
}

function buildImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  const cleaned = imagePath
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/^public\//, '')
    .replace(/^\/+/, '');
  return `/${cleaned}`;
}

function cacheProduct(product) {
  if (!product?.barcode) return;
  productCache.set(product.barcode, product);
}

function getCachedProduct(barcode) {
  if (!barcode) return null;
  if (productCache.has(barcode)) {
    return productCache.get(barcode);
  }
  const product = getProductByBarcode(barcode);
  if (product) {
    cacheProduct(product);
  }
  return product || null;
}

function hydrateProductCache() {
  try {
    const products = listProducts();
    products.forEach(cacheProduct);
    if (products.length) {
      console.log(`Catálogo local precargado: ${products.length} productos.`);
    }
  } catch (error) {
    console.warn('No se pudo precargar el catálogo local:', error.message);
  }
}

hydrateProductCache();

function isVariablePricing(source) {
  if (!source) return false;
  const values = [
    source.pricingMode,
    source.pricing_mode,
    source.category,
    source.productName,
    source.name,
  ]
    .filter(Boolean)
    .map((value) => value.toString().toLowerCase());
  return values.includes('varios') || values.includes('variable');
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
    imageUrl: buildImageUrl(product.image_path ?? product.imagePath),
  };
}

function mapScanToClient(scan, product = null) {
  const productData = product || getCachedProduct(scan.barcode) || {};
  const priceCandidate =
    scan.priceCents ??
    scan.price_cents ??
    productData.default_price_cents ??
    productData.defaultPriceCents ??
    null;

  return {
    id: scan.id,
    barcode: scan.barcode,
    productName:
      scan.productName ||
      scan.product_name ||
      productData.name ||
      scan.barcode,
    category: scan.category || productData.category || null,
    pricingMode:
      scan.pricingMode ||
      scan.pricing_mode ||
      productData.pricing_mode ||
      productData.pricingMode ||
      null,
    priceCents:
      typeof priceCandidate === 'number' ? priceCandidate : null,
    quantity: scan.quantity || 1,
    scannedAt: scan.scannedAt || scan.scanned_at || new Date().toISOString(),
    status: scan.status || 'pending',
    imageUrl:
      scan.imageUrl ||
      buildImageUrl(scan.image_path || productData.image_path || productData.imagePath),
  };
}

function buildPendingVariableScan(scan, product = null, overrides = {}) {
  const enriched = mapScanToClient(
    {
      ...scan,
      status: 'pending',
    },
    product,
  );

  return {
    ...enriched,
    pricingMode: enriched.pricingMode || 'variable',
    priceCents: null,
    ...overrides,
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
        const numericPrice = Number(rawPrice);
        const defaultPriceCents =
          rawPrice == null || Number.isNaN(numericPrice)
            ? null
            : Math.round(numericPrice);

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
      if (stored) cacheProduct(stored);
    }

    const catalogDto = listProducts().map(mapProductToDto);
    io.emit('products-refreshed', catalogDto);
    console.log(`Catálogo actualizado con ${normalized.length} productos.`);
  } catch (error) {
    console.error('Error cargando catálogo:', error.message);
  }
}

function persistAccepted(ids, payloadScans) {
  const lines = payloadScans
    .filter((scan) => ids.includes(scan.id))
    .map((scan) =>
      JSON.stringify({
        ...scan,
        syncedAt: new Date().toISOString(),
      }),
    );

  if (lines.length === 0) return;

  fs.appendFileSync('./synced.log', `${lines.join('\n')}\n`);
}

function persistRejected(reject) {
  fs.appendFileSync(
    './rejected.log',
    `${new Date().toISOString()} ${reject.id} ${reject.reason || 'unknown'}\n`,
  );
}

function findPendingVariablePriceScan() {
  const pending = getPendingScans();
  for (const scan of pending) {
    const product = getCachedProduct(scan.barcode);
    const pricingMode =
      scan.pricing_mode ||
      scan.pricingMode ||
      product?.pricing_mode ||
      product?.pricingMode;
    const category = scan.category || product?.category || null;
    const productName = scan.product_name || product?.name || null;
    const isVariable = isVariablePricing({
      pricingMode,
      category,
      productName,
    });
    const priceCents =
      scan.price_cents ?? scan.priceCents ?? product?.default_price_cents ?? null;
    if (isVariable && (!priceCents || priceCents <= 0)) {
      return buildPendingVariableScan(scan, product);
    }
  }
  return null;
}

function handleSyncResult(result, pending, payloadScans = []) {
  if (!result || typeof result !== 'object') {
    return;
  }

  const accepted = new Set(result.acceptedIds || []);
  const rejected = result.rejected || [];
  const variablePriceRequired = result.variablePriceRequired || [];

  if (accepted.size) {
    const syncedAt = new Date().toISOString();
    markAsSynced([...accepted], syncedAt);
    if (payloadScans.length) {
      persistAccepted([...accepted], payloadScans);
    }

    for (const id of accepted) {
      const scan = pending.find((item) => item.id === id);
      if (!scan) continue;
      const product = getCachedProduct(scan.barcode);
      const sale = broadcastSale(
        { ...scan, status: 'synced', synced_at: syncedAt, syncedAt },
        product,
        'synced',
      );
      io.emit('sale-completed', sale);
    }
  }

  for (const item of variablePriceRequired) {
    const scan = pending.find((entry) => entry.id === item.id);
    if (!scan) continue;
    enqueueVariablePrice(scan, getCachedProduct(scan.barcode), {
      productName: item.productName || scan.product_name,
      category: item.category || scan.category,
    });
  }

  for (const rej of rejected) {
    markAsRejected(rej.id);
    persistRejected(rej);
    io.emit('sale-rejected', {
      id: rej.id,
      reason: rej.reason || 'Rechazado por backend',
    });
    const rejectedScan = pending.find((item) => item.id === rej.id);
    if (rejectedScan) {
      broadcastSale(
        { ...rejectedScan, status: 'rejected' },
        getCachedProduct(rejectedScan.barcode),
        'rejected',
      );
    }
  }

  if (!pendingVariablePriceScan) {
    pendingVariablePriceScan = findPendingVariablePriceScan();
  }
}

function enqueueVariablePrice(scanRow, product = null, overrides = {}) {
  const variableSource = {
    pricingMode:
      overrides.pricingMode ||
      scanRow.pricingMode ||
      scanRow.pricing_mode ||
      product?.pricing_mode ||
      product?.pricingMode,
    category: overrides.category || scanRow.category || scanRow.product_category || product?.category,
    productName:
      overrides.productName ||
      scanRow.productName ||
      scanRow.product_name ||
      product?.name,
  };

  if (!isVariablePricing(variableSource)) {
    console.warn(
      `Se ignoró una solicitud de precio variable para ${scanRow.barcode} porque no pertenece a la categoría 'Varios'.`,
    );
    return;
  }

  const pending = buildPendingVariableScan(
    {
      ...scanRow,
      pricing_mode: variableSource.pricingMode,
      category: variableSource.category,
      product_name: variableSource.productName,
    },
    product,
    overrides,
  );
  pendingVariablePriceScan = pending;
  broadcastSale(pending, product, 'pending');
  io.emit('variable-price-required', pending);
}

function addScan(rawBarcode, source = 'stdin') {
  const barcode = (rawBarcode || '').trim();
  if (!barcode) return;

  const now = new Date().toISOString();
  const product = getCachedProduct(barcode);
  const pricingMode = product?.pricing_mode ?? product?.pricingMode ?? null;
  const category = product?.category ?? null;
  const productName = product?.name ?? null;
  const imagePath = product?.image_path ?? product?.imagePath ?? null;
  const defaultPrice =
    typeof product?.default_price_cents === 'number'
      ? product.default_price_cents
      : typeof product?.defaultPriceCents === 'number'
      ? product.defaultPriceCents
      : null;
  const variable = isVariablePricing({
    pricingMode,
    category,
    productName,
  });

  const scanRecord = {
    id: uuid(),
    barcode,
    deviceId: config.deviceId,
    scannedAt: now,
    productName,
    category,
    priceCents: variable ? null : defaultPrice,
    imagePath,
  };

  saveScan(scanRecord);
  io.emit('scan-received', { id: scanRecord.id, barcode });
  console.log(`Lectura registrada (${source}): ${barcode}`);

  broadcastSale(scanRecord, product, 'pending');

  if (variable && !pendingVariablePriceScan) {
    enqueueVariablePrice(
      {
        id: scanRecord.id,
        barcode,
        device_id: scanRecord.deviceId,
        scanned_at: now,
        product_name: productName,
        category,
        image_path: imagePath,
      },
      product,
    );
  } else {
    triggerSync();
  }
}

async function triggerSync() {
  if (syncing) return;

  const pending = getPendingScans();
  if (pending.length === 0) return;

  const payloadScans = [];

  for (const scan of pending) {
    const product = getCachedProduct(scan.barcode);
    const pricingMode =
      scan.pricing_mode ||
      scan.pricingMode ||
      product?.pricing_mode ||
      product?.pricingMode;
    const category = scan.category || product?.category || null;
    const productName = scan.product_name || product?.name || null;
    const priceCents =
      typeof scan.price_cents === 'number'
        ? scan.price_cents
        : typeof product?.default_price_cents === 'number'
        ? product.default_price_cents
        : typeof product?.defaultPriceCents === 'number'
        ? product.defaultPriceCents
        : null;
    const isVariable = isVariablePricing({
      pricingMode,
      category,
      productName,
    });
    const needsPrice = isVariable && (!priceCents || priceCents <= 0);

    if (needsPrice) {
      if (!pendingVariablePriceScan || pendingVariablePriceScan.id !== scan.id) {
        enqueueVariablePrice(scan, product);
        console.log(`Precio variable requerido para ${scan.barcode}`);
      }
      continue;
    }

    const payload = {
      id: scan.id,
      barcode: scan.barcode,
      deviceId: scan.device_id,
      scannedAt: scan.scanned_at,
    };

    if (isVariable && priceCents) {
      payload.variablePriceCents = toRemotePrice(priceCents);
    }

    payloadScans.push(payload);
  }

  if (!payloadScans.length) {
    return;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (config.jwt) headers.Authorization = `Bearer ${config.jwt}`;

  syncing = true;
  try {
    const apiBase = config.apiBase.replace(/\/$/, '');
    const { data } = await axios.post(
      `${apiBase}/scans/bulk`,
      { scans: payloadScans },
      { headers, timeout: 5000 },
    );

    handleSyncResult(data, pending, payloadScans);
  } catch (error) {
    const responseData = error.response?.data;
    const message = responseData?.error || error.message;
    console.error('Error sincronizando:', message, responseData || '');
    if (responseData) {
      handleSyncResult(responseData, pending);
    }
    io.emit('sync-error', { message, details: responseData });
    if (error.code === 'ENETUNREACH' || error.code === 'ECONNREFUSED') {
      setTimeout(() => {
        if (!syncing) triggerSync();
      }, 5000);
    }
  } finally {
    syncing = false;
  }
}

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/api/sales/today', (_req, res) => {
  const sales = getTodaySales();
  const summary = {
    totalItems: sales.reduce((sum, s) => sum + (s.quantity || 1), 0),
    totalCents: sales.reduce((sum, s) => sum + (s.price_cents || 0), 0),
    sales: sales.map((s) => mapScanToClient(s)),
  };
  res.json(summary);
});

app.get('/api/pending-variable-price', (_req, res) => {
  res.json(pendingVariablePriceScan || null);
});

app.get('/api/products', (_req, res) => {
  const products = listProducts().map(mapProductToDto);
  res.json(products);
});

app.post('/api/products/refresh', async (_req, res) => {
  await loadProductCatalog();
  res.json({ success: true });
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
    cacheProduct(getProductByBarcode(barcode));

    const dto = mapProductToDto(productCache.get(barcode));
    io.emit('product-updated', dto);
    res.json({ success: true, product: dto });
  } catch (error) {
    next(error);
  }
});

app.post('/api/scan', (req, res) => {
  const { barcode } = req.body || {};
  if (!barcode || typeof barcode !== 'string' || barcode.trim().length === 0) {
    return res.status(400).json({ error: 'Código de barras inválido' });
  }

  addScan(barcode, 'http');
  res.json({ success: true, barcode: barcode.trim() });
});

app.post('/api/set-variable-price', async (req, res) => {
  const { scanId, priceCents } = req.body || {};

  if (!scanId || typeof priceCents !== 'number' || priceCents <= 0) {
    return res.status(400).json({ error: 'scanId y priceCents válidos requeridos' });
  }

  if (!pendingVariablePriceScan || pendingVariablePriceScan.id !== scanId) {
    return res.status(404).json({ error: 'Scan no encontrado o ya procesado' });
  }

  const variableScan = pendingVariablePriceScan;
  pendingVariablePriceScan = null;

  updateScanPrice(scanId, priceCents);

  const product = getCachedProduct(variableScan.barcode);
  const baseSale = {
    ...variableScan,
    priceCents,
    price_cents: priceCents,
    status: 'pending',
  };

  const pendingSaleDto = broadcastSale(baseSale, product, 'pending');

  const headers = { 'Content-Type': 'application/json' };
  if (config.jwt) headers.Authorization = `Bearer ${config.jwt}`;
  const apiBase = config.apiBase.replace(/\/$/, '');
  const variable = isVariablePricing(variableScan);

  try {
    if (variable) {
      await axios.post(
        `${apiBase}/sales/varios`,
        {
          priceCents: toRemotePrice(priceCents),
          quantity: variableScan.quantity || 1,
          deviceId: config.deviceId,
        },
        { headers, timeout: 5000 },
      );

      const syncedAt = new Date().toISOString();
      markAsSynced([scanId], syncedAt);

      const saleDto = broadcastSale(
        { ...baseSale, status: 'synced', syncedAt },
        product,
        'synced',
      );
      io.emit('sale-completed', saleDto);
      triggerSync();
      return res.json({ success: true, sale: saleDto });
    }

    const payload = {
      scans: [
        {
          id: variableScan.id,
          barcode: variableScan.barcode,
          deviceId: config.deviceId,
          scannedAt: variableScan.scannedAt,
          variablePriceCents: toRemotePrice(priceCents),
        },
      ],
    };

    const { data } = await axios.post(`${apiBase}/scans/bulk`, payload, {
      headers,
      timeout: 5000,
    });

    const accepted = new Set(data.acceptedIds || []);
    const rejected = data.rejected || [];

    if (accepted.has(scanId)) {
      const syncedAt = new Date().toISOString();
      markAsSynced([scanId], syncedAt);

      const saleDto = broadcastSale(
        { ...baseSale, status: 'synced', syncedAt },
        product,
        'synced',
      );
      io.emit('sale-completed', saleDto);
      triggerSync();
      return res.json({ success: true, sale: saleDto });
    }

    const rejection = rejected.find((item) => item.id === scanId);
    if (rejection) {
      markAsRejected(scanId);
      persistRejected(rejection);
      io.emit('sale-rejected', { id: scanId, reason: rejection.reason });
      return res.status(502).json({ error: rejection.reason || 'Rechazado' });
    }

    throw new Error('El backend no procesó el scan');
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    console.error('Error enviando precio variable:', message);
    triggerSync();
    return res
      .status(202)
      .json({ success: true, pendingSync: true, sale: pendingSaleDto, error: message });
  }
});

app.use((error, _req, res, _next) => {
  console.error('Error en la API:', error);
  res.status(500).json({ error: error.message || 'Error interno' });
});

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);
  const sales = getTodaySales();
  if (!pendingVariablePriceScan) {
    pendingVariablePriceScan = findPendingVariablePriceScan();
  }

  socket.emit('initial-data', {
    sales: sales.map((s) => mapScanToClient(s)),
    pendingVariablePrice: pendingVariablePriceScan,
    products: listProducts().map(mapProductToDto),
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

function startUsbListener() {
  const devicePath = process.env.USB_SCANNER_DEVICE;
  if (!devicePath) {
    console.log('USB_SCANNER_DEVICE no definido. Escáner USB deshabilitado.');
    return;
  }

  if (!fs.existsSync(devicePath)) {
    console.warn(`El dispositivo USB ${devicePath} no existe.`);
    return;
  }

  const usbListener = new USBScannerListener(devicePath);
  usbListener.on('scan', (code) => addScan(code, 'usb'));
  usbListener.on('error', (error) => {
    console.error('Error en el escáner USB:', error.message);
  });
  usbListener.start();
}

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log('==========================================');
  console.log('  Servidor de Inventario Iniciado');
  console.log('  Puerto:', PORT);
  console.log('  WebSocket: activo');
  console.log('==========================================');

  loadProductCatalog();
  setInterval(loadProductCatalog, config.catalogRefreshMs);
  setInterval(triggerSync, config.syncIntervalMs);
  triggerSync();
  pendingVariablePriceScan = findPendingVariablePriceScan();

  listen((code) => addScan(code, 'stdin'));
  startUsbListener();
});
