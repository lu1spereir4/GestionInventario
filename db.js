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

db.exec(`
  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    scan_id TEXT,
    barcode TEXT NOT NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total REAL NOT NULL,
    image TEXT,
    sold_at TEXT NOT NULL
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

const insertSaleStmt = db.prepare(`
  INSERT INTO sales (
    id,
    scan_id,
    barcode,
    product_name,
    price,
    quantity,
    total,
    image,
    sold_at
  ) VALUES (
    @id,
    @scanId,
    @barcode,
    @productName,
    @price,
    @quantity,
    @total,
    @image,
    @soldAt
  )
`);

const todaySummaryStmt = db.prepare(`
  SELECT
    COUNT(*) as count,
    IFNULL(SUM(total), 0) as revenue
  FROM sales
  WHERE date(sold_at, 'localtime') = date('now', 'localtime')
`);

const recentSalesStmt = db.prepare(`
  SELECT
    id,
    scan_id as scanId,
    barcode,
    product_name as productName,
    price,
    quantity,
    total,
    image,
    sold_at as soldAt
  FROM sales
  ORDER BY datetime(sold_at) DESC
  LIMIT ?
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

export function recordSale(sale) {
  insertSaleStmt.run({
    id: sale.id,
    scanId: sale.scanId ?? null,
    barcode: sale.barcode,
    productName: sale.productName,
    price: sale.price,
    quantity: sale.quantity ?? 1,
    total: sale.total,
    image: sale.image ?? null,
    soldAt: sale.soldAt,
  });

  return {
    ...sale,
    price: Number(sale.price),
    total: Number(sale.total),
  };
}

export function getTodaySummary() {
  const result = todaySummaryStmt.get();
  return {
    count: Number(result?.count ?? 0),
    revenue: Number(result?.revenue ?? 0),
  };
}

export function getRecentSales(limit = 10) {
  return recentSalesStmt
    .all(limit)
    .map((sale) => ({
      ...sale,
      price: Number(sale.price),
      quantity: Number(sale.quantity),
      total: Number(sale.total),
    }));
}

