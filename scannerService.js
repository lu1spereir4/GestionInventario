import fs from 'fs';
import EventEmitter from 'events';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import config from './sync.config.js';
import { listen } from './barcodeScanner.js';
import {
  saveScan,
  getPendingScans,
  markAsSynced,
  markAsRejected,
  recordSale,
  getTodaySummary,
  getRecentSales as fetchRecentSales,
} from './db.js';
import { findProductByBarcode } from './products.js';

export class ScannerService extends EventEmitter {
  constructor() {
    super();
    this.syncing = false;
    this.pendingVariableSales = new Map();
  }

  start() {
    console.log('Simulador listo. Escanea o escribe un código; se autoenvía al completar.');
    listen(this.handleBarcode.bind(this));
    setInterval(() => this.triggerSync(), config.syncIntervalMs);
    this.triggerSync();
  }

  handleBarcode(barcode) {
    const scan = {
      id: uuid(),
      barcode,
      deviceId: config.deviceId,
      scannedAt: new Date().toISOString(),
    };

    saveScan(scan);
    this.emit('scan:saved', scan);

    const product = findProductByBarcode(barcode);

    if (!product) {
      this.emit('scan:unknown', { barcode, scanId: scan.id });
      this.triggerSync();
      return;
    }

    if (product.price == null) {
      const pending = {
        scanId: scan.id,
        barcode: scan.barcode,
        productName: product.name,
        image: product.image,
        requestedAt: new Date().toISOString(),
      };
      this.pendingVariableSales.set(scan.id, { ...pending, product, scan });
      this.emit('sale:needs-price', pending);
    } else {
      this.completeSale({ scan, product, price: product.price });
    }

    this.triggerSync();
  }

  completeSale({ scan, product, price }) {
    const sale = {
      id: uuid(),
      scanId: scan?.id ?? null,
      barcode: scan?.barcode ?? product.barcode,
      productName: product.name,
      price: Number(price),
      quantity: 1,
      total: Number(price),
      image: product.image ?? null,
      soldAt: new Date().toISOString(),
    };

    const storedSale = recordSale(sale);
    this.emit('sale:completed', storedSale);
    this.emit('summary:update', this.getSummary());
  }

  setVariablePrice(scanId, price) {
    const pending = this.pendingVariableSales.get(scanId);
    if (!pending) {
      throw new Error('No existe una venta pendiente para este código.');
    }

    this.pendingVariableSales.delete(scanId);

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      throw new Error('El precio debe ser mayor que 0.');
    }

    this.completeSale({
      scan: pending.scan,
      product: pending.product,
      price: numericPrice,
    });

    return this.getRecentSales()[0];
  }

  getSummary() {
    return getTodaySummary();
  }

  getRecentSales(limit = 10) {
    return fetchRecentSales(limit);
  }

  getPendingVariableSales() {
    return Array.from(this.pendingVariableSales.values()).map((entry) => ({
      scanId: entry.scan.id,
      barcode: entry.scan.barcode,
      productName: entry.product.name,
      image: entry.product.image,
      requestedAt: entry.requestedAt,
    }));
  }

  async triggerSync() {
    if (this.syncing) return;
    const pending = getPendingScans();
    if (pending.length === 0) return;

    this.syncing = true;
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

      if (accepted.size) {
        markAsSynced([...accepted], new Date().toISOString());
        this.persistAccepted([...accepted], pending);
        this.emit('sync:accepted', accepted.size);
      }

      for (const rej of rejected) {
        markAsRejected(rej.id);
        this.persistRejected(rej);
        this.emit('sync:rejected', rej);
      }
    } catch (error) {
      this.emit('sync:error', error);
    } finally {
      this.syncing = false;
    }
  }

  persistAccepted(ids, payloadScans) {
    const lines = payloadScans
      .filter((scan) => ids.includes(scan.id))
      .map((scan) => JSON.stringify({
        ...scan,
        syncedAt: new Date().toISOString(),
      }));

    if (lines.length === 0) return;

    fs.appendFileSync('./synced.log', lines.join('\n') + '\n');
  }

  persistRejected(reject) {
    fs.appendFileSync(
      './rejected.log',
      `${new Date().toISOString()} ${reject.id} ${reject.reason}\n`,
    );
  }
}
