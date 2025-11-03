import fs from 'fs';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import config from './sync.config.js';
import { listen } from './barcodeScanner.js';
import {
  saveScan,
  getPendingScans,
  markAsSynced,
  markAsRejected,
} from './db.js';

let syncing = false;

function addScan(barcode) {
  const scan = {
    id: uuid(),
    barcode,
    deviceId: config.deviceId,
    scannedAt: new Date().toISOString(),
  };

  saveScan(scan);
  console.log(`Lectura registrada: ${barcode}`);
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

    if (accepted.size) {
      markAsSynced([...accepted], new Date().toISOString());
      persistAccepted([...accepted], pending);
      console.log(`✔ Enviados: ${accepted.size}`);
    }

    for (const rej of rejected) {
      markAsRejected(rej.id);
      persistRejected(rej);
      console.warn(`✖ Rechazado ${rej.id}: ${rej.reason}`);
    }
  } catch (error) {
    console.error('Error sincronizando:', error.message);
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

console.log('Simulador listo. Escanea o escribe un código; se autoenvía al completar.');
listen(addScan);
setInterval(triggerSync, config.syncIntervalMs);
triggerSync();

