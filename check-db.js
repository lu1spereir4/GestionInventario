import Database from 'better-sqlite3';
import config from './sync.config.js';

const db = new Database(config.dbFile);

console.log('📊 Estado de la Base de Datos SQLite\n');
console.log('=' .repeat(60));

// Verificar si la tabla existe
const tableInfo = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name='scans'
`).get();

if (!tableInfo) {
  console.log('❌ La tabla "scans" no existe');
  process.exit(1);
}

console.log('✅ Tabla "scans" existe\n');

// Contar registros totales
const totalCount = db.prepare('SELECT COUNT(*) as count FROM scans').get();
console.log(`📦 Total de registros: ${totalCount.count}`);

// Contar por estado
const statusCounts = db.prepare(`
  SELECT status, COUNT(*) as count 
  FROM scans 
  GROUP BY status
`).all();

console.log('\n📊 Por estado:');
statusCounts.forEach(row => {
  const emoji = row.status === 'synced' ? '✅' : row.status === 'pending' ? '⏳' : '❌';
  console.log(`  ${emoji} ${row.status}: ${row.count}`);
});

// Mostrar últimos 10 registros
const recentScans = db.prepare(`
  SELECT * FROM scans 
  ORDER BY datetime(scanned_at) DESC 
  LIMIT 10
`).all();

console.log('\n📋 Últimos 10 registros:\n');
console.log('=' .repeat(100));
console.log(`${'ID'.padEnd(38)} ${'Código'.padEnd(15)} ${'Estado'.padEnd(10)} ${'Fecha'.padEnd(20)}`);
console.log('=' .repeat(100));

if (recentScans.length === 0) {
  console.log('(No hay registros)');
} else {
  recentScans.forEach(scan => {
    const id = scan.id.substring(0, 8) + '...';
    const barcode = scan.barcode.padEnd(15);
    const status = scan.status.padEnd(10);
    const date = new Date(scan.scanned_at).toLocaleString('es-ES');
    console.log(`${id.padEnd(38)} ${barcode} ${status} ${date}`);
  });
}

// Registros de hoy
const todayScans = db.prepare(`
  SELECT COUNT(*) as count 
  FROM scans 
  WHERE date(scanned_at) = date('now')
`).get();

console.log('\n' + '=' .repeat(100));
console.log(`\n📅 Scans de hoy: ${todayScans.count}`);

// Información del archivo
const fs = await import('fs');
const stats = fs.statSync(config.dbFile);
console.log(`💾 Tamaño de la base de datos: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`📍 Ubicación: ${config.dbFile}`);

db.close();
