import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import config from './sync.config.js';
import {
  saveScan,
  getPendingScans,
  markAsSynced,
  markAsRejected,
  getTodaySales,
} from './db.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

let syncing = false;
let pendingVariablePriceScan = null;

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
    sales: sales.map(s => ({
      id: s.id,
      barcode: s.barcode,
      productName: s.product_name || 'Producto desconocido',
      category: s.category,
      priceCents: s.price_cents,
      quantity: s.quantity || 1,
      scannedAt: s.scanned_at,
      status: s.status
    }))
  };
  res.json(summary);
});

// Endpoint para obtener scan pendiente de precio variable
app.get('/api/pending-variable-price', (req, res) => {
  res.json(pendingVariablePriceScan || null);
});

// Endpoint para simular escaneo (útil para pruebas sin lector)
app.post('/api/simulate-scan', (req, res) => {
  const { barcode } = req.body;
  if (!barcode) {
    return res.status(400).json({ error: 'barcode requerido' });
  }
  
  console.log(`🧪 Simulando escaneo: ${barcode}`);
  addScan(barcode);
  res.json({ success: true, message: 'Escaneo simulado' });
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
      markAsSynced([scanId], new Date().toISOString());
      
      const sale = {
        ...pendingVariablePriceScan,
        priceCents,
        status: 'synced'
      };
      
      io.emit('sale-completed', sale);
      console.log(`✔ Venta con precio variable: $${(priceCents / 100).toFixed(2)}`);
      
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
  const scan = {
    id: uuid(),
    barcode,
    deviceId: config.deviceId,
    scannedAt: new Date().toISOString(),
  };

  saveScan(scan);
  console.log(`📦 Lectura registrada: ${barcode}`);
  
  // Emitir al frontend
  io.emit('scan-received', scan);
  
  // Intentar sincronizar
  triggerSync();
}

async function triggerSync() {
  if (syncing) return;
  const pending = getPendingScans();
  if (pending.length === 0) return;

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

    const accepted = new Set(data.acceptedIds || []);
    const rejected = data.rejected || [];
    const variablePriceRequired = data.variablePriceRequired || [];

    if (accepted.size) {
      markAsSynced([...accepted], new Date().toISOString());
      persistAccepted([...accepted], pending);
      console.log(`✔ Enviados: ${accepted.size}`);
      
      // Emitir ventas completadas
      for (const id of accepted) {
        const scan = pending.find(s => s.id === id);
        if (scan) {
          io.emit('sale-completed', {
            id: scan.id,
            barcode: scan.barcode,
            scannedAt: scan.scanned_at,
            status: 'synced'
          });
        }
      }
    }

    // Manejar productos que requieren precio variable
    for (const item of variablePriceRequired) {
      const scan = pending.find(s => s.id === item.id);
      if (scan) {
        pendingVariablePriceScan = {
          id: scan.id,
          barcode: scan.barcode,
          deviceId: scan.device_id,
          scannedAt: scan.scanned_at,
          productName: item.productName || 'Varios',
          category: item.category || 'varios'
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
    sales: sales.map(s => ({
      id: s.id,
      barcode: s.barcode,
      productName: s.product_name || 'Producto desconocido',
      category: s.category,
      priceCents: s.price_cents,
      quantity: s.quantity || 1,
      scannedAt: s.scanned_at,
      status: s.status
    })),
    pendingVariablePrice: pendingVariablePriceScan
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║  🚀 Servidor de Inventario Iniciado      ║
║                                           ║
║  Puerto: ${PORT}                            ║
║  WebSocket: Activo                        ║
║  Modo: Sin escáner (API solamente)        ║
╚═══════════════════════════════════════════╝

💡 Para simular escaneos, usa:
   POST http://localhost:${PORT}/api/simulate-scan
   Body: { "barcode": "123456789012" }

🔌 Frontend: http://localhost:5173
  `);
  
  // Sincronización periódica
  setInterval(triggerSync, config.syncIntervalMs);
  triggerSync();
});
