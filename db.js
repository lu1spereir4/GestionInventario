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
    attempts INTEGER NOT NULL DEFAULT 0,
    product_name TEXT,
    category TEXT,
    price_cents INTEGER,
    image_path TEXT,
    remote_sale_id TEXT
  );
`);

// Ensure legacy databases get the new columns
const scanColumns = new Set(db.prepare('PRAGMA table_info(scans)').all().map((col) => col.name));
if (!scanColumns.has('product_name')) db.exec(`ALTER TABLE scans ADD COLUMN product_name TEXT`);
if (!scanColumns.has('category')) db.exec(`ALTER TABLE scans ADD COLUMN category TEXT`);
if (!scanColumns.has('price_cents')) db.exec(`ALTER TABLE scans ADD COLUMN price_cents INTEGER`);
if (!scanColumns.has('image_path')) db.exec(`ALTER TABLE scans ADD COLUMN image_path TEXT`);
if (!scanColumns.has('remote_sale_id')) db.exec(`ALTER TABLE scans ADD COLUMN remote_sale_id TEXT`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    barcode TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    pricing_mode TEXT NOT NULL,
    default_price_cents INTEGER,
    source_type TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    image_path TEXT,
    updated_at TEXT NOT NULL
  );
`);

const insertScanStmt = db.prepare(`
  INSERT INTO scans (
    id,
    barcode,
    device_id,
    scanned_at,
    product_name,
    category,
    price_cents,
    image_path
  )
  VALUES (
    @id,
    @barcode,
    @deviceId,
    @scannedAt,
    @productName,
    @category,
    @priceCents,
    @imagePath
  )
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

const updateScanPriceStmt = db.prepare(`
  UPDATE scans SET price_cents = @priceCents WHERE id = @id
`);

const updateScanProductInfoStmt = db.prepare(`
  UPDATE scans
  SET
    product_name = COALESCE(@productName, product_name),
    category = COALESCE(@category, category),
    image_path = COALESCE(@imagePath, image_path)
  WHERE barcode = @barcode
    AND product_name IS NULL
`);

const upsertProductStmt = db.prepare(`
  INSERT INTO products (
    barcode,
    name,
    category,
    pricing_mode,
    default_price_cents,
    source_type,
    active,
    image_path,
    updated_at
  )
  VALUES (
    @barcode,
    @name,
    @category,
    @pricingMode,
    @defaultPriceCents,
    @sourceType,
    @active,
    @imagePath,
    @updatedAt
  )
  ON CONFLICT(barcode) DO UPDATE SET
    name = excluded.name,
    category = excluded.category,
    pricing_mode = excluded.pricing_mode,
    default_price_cents = excluded.default_price_cents,
    source_type = excluded.source_type,
    active = excluded.active,
    updated_at = excluded.updated_at,
    image_path = COALESCE(products.image_path, excluded.image_path)
`);

const selectProductStmt = db.prepare(`
  SELECT * FROM products WHERE barcode = ?
`);

const listProductsStmt = db.prepare(`
  SELECT * FROM products ORDER BY name COLLATE NOCASE
`);

const updateProductImageStmt = db.prepare(`
  UPDATE products
  SET image_path = @imagePath,
      updated_at = @updatedAt
  WHERE barcode = @barcode
`);

const updateScansImageStmt = db.prepare(`
  UPDATE scans
  SET image_path = @imagePath
  WHERE barcode = @barcode
`);

const selectScanByIdStmt = db.prepare(`
  SELECT * FROM scans WHERE id = ?
`);

const deleteScanStmt = db.prepare(`
  DELETE FROM scans WHERE id = ?
`);

const updateRemoteSaleIdStmt = db.prepare(`
  UPDATE scans
  SET remote_sale_id = @remoteSaleId
  WHERE id = @id
`);

export function saveScan(scan) {
  insertScanStmt.run({
    ...scan,
    productName: scan.productName ?? null,
    category: scan.category ?? null,
    priceCents: typeof scan.priceCents === 'number' ? scan.priceCents : null,
    imagePath: scan.imagePath ?? null,
  });

  if (scan.productName || scan.category || scan.imagePath) {
    updateScanProductInfoStmt.run({
      barcode: scan.barcode,
      productName: scan.productName ?? null,
      category: scan.category ?? null,
      imagePath: scan.imagePath ?? null,
    });
  }
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

export function updateScanPrice(id, priceCents) {
  updateScanPriceStmt.run({ id, priceCents });
}

const todaySalesStmt = db.prepare(`
  SELECT * FROM scans
  WHERE date(scanned_at) = date('now')
  ORDER BY datetime(scanned_at) DESC
`);

export function getTodaySales() {
  return todaySalesStmt.all();
}

const upsertProductTransaction = db.transaction((products) => {
  products.forEach((product) => {
    upsertProductStmt.run({
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      pricingMode: product.pricingMode,
      defaultPriceCents: product.defaultPriceCents ?? null,
      sourceType: product.sourceType,
      active: product.active ? 1 : 0,
      imagePath: product.imagePath ?? null,
      updatedAt: product.updatedAt ?? new Date().toISOString(),
    });

    updateScanProductInfoStmt.run({
      barcode: product.barcode,
      productName: product.name,
      category: product.category,
      imagePath: product.imagePath ?? null,
    });
  });
});

export function upsertProducts(products) {
  if (!Array.isArray(products) || products.length === 0) return;
  upsertProductTransaction(products);
}

export function getProductByBarcode(barcode) {
  return selectProductStmt.get(barcode) || null;
}

export function listProducts() {
  return listProductsStmt.all();
}

export function updateProductImage(barcode, imagePath) {
  const updatedAt = new Date().toISOString();
  updateProductImageStmt.run({ barcode, imagePath, updatedAt });
  updateScansImageStmt.run({ barcode, imagePath });
}

export function getScanById(id) {
  return selectScanByIdStmt.get(id) || null;
}

export function deleteScan(id) {
  deleteScanStmt.run(id);
}

export function setRemoteSaleId(id, remoteSaleId) {
  if (!id || !remoteSaleId) return;
  updateRemoteSaleIdStmt.run({ id, remoteSaleId });
}


