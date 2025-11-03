import Database from 'better-sqlite3';
import config from './sync.config.js';

const db = new Database(config.dbFile);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL,
    device_id TEXT NOT NULL,
    scanned_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    synced_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0
  );
`);

const insertScanStmt = db.prepare(`
  INSERT INTO scans (id, barcode, device_id, scanned_at)
  VALUES (@id, @barcode, @deviceId, @scannedAt)
`);

const pendingStmt = db.prepare(`
  SELECT * FROM scans
  WHERE status = 'pending'
  ORDER BY datetime(scanned_at) ASC
`);

const markSyncedStmt = db.prepare(`
  UPDATE scans
  SET status = 'synced',
      synced_at = @syncedAt
  WHERE id IN (SELECT value FROM json_each(@idsJson))
`);

const markRejectedStmt = db.prepare(`
  UPDATE scans
  SET status = 'rejected',
      attempts = attempts + 1
  WHERE id = @id
`);

export function saveScan(scan) {
  insertScanStmt.run(scan);
}

export function getPendingScans() {
  return pendingStmt.all();
}

export function markAsSynced(ids, syncedAt) {
  if (!ids.length) return;
  markSyncedStmt.run({
    idsJson: JSON.stringify(ids),
    syncedAt,
  });
}

export function markAsRejected(id) {
  markRejectedStmt.run({ id });
}

const todaySalesStmt = db.prepare(`
  SELECT * FROM scans
  WHERE date(scanned_at) = date('now')
  ORDER BY datetime(scanned_at) DESC
`);

export function getTodaySales() {
  return todaySalesStmt.all();
}

