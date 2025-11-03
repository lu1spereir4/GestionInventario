import http from 'http';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { ScannerService } from './scannerService.js';
import { products } from './products.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const scanner = new ScannerService();
const clients = new Set();

function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });

  ws.send(
    JSON.stringify({
      type: 'dashboard:init',
      payload: {
        summary: scanner.getSummary(),
        recentSales: scanner.getRecentSales(),
        pendingVariableSales: scanner.getPendingVariableSales(),
      },
    }),
  );
});

scanner.on('sale:completed', (sale) => {
  broadcast('sale:completed', sale);
});

scanner.on('summary:update', (summary) => {
  broadcast('summary:update', summary);
});

scanner.on('sale:needs-price', (pending) => {
  broadcast('sale:needs-price', pending);
});

scanner.on('scan:unknown', ({ barcode }) => {
  broadcast('scan:unknown', { barcode });
});

scanner.on('sync:error', (error) => {
  broadcast('sync:error', { message: error.message });
});

app.get('/api/dashboard', (req, res) => {
  res.json({
    summary: scanner.getSummary(),
    recentSales: scanner.getRecentSales(),
    pendingVariableSales: scanner.getPendingVariableSales(),
  });
});

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.post('/api/sales/:scanId/price', (req, res) => {
  const { scanId } = req.params;
  const { price } = req.body ?? {};

  try {
    const sale = scanner.setVariablePrice(scanId, price);
    res.json({ sale });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, 'vite.config.js'),
      server: { middlewareMode: true },
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = process.env.PORT || 4173;
  server.listen(port, () => {
    console.log(`Servidor listo en http://localhost:${port}`);
  });

  scanner.start();
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
