import { ScannerService } from './scannerService.js';

const scanner = new ScannerService();

scanner.on('sale:completed', (sale) => {
  console.log(`✔ Venta registrada: ${sale.productName} - $${sale.total}`);
});

scanner.on('sale:needs-price', (pending) => {
  console.log(
    `⚠ Se necesita precio para ${pending.productName} (${pending.barcode}). Asigna el monto desde la interfaz web.`,
  );
});

scanner.on('scan:unknown', ({ barcode }) => {
  console.warn(`Código sin asignar en catálogo local: ${barcode}`);
});

scanner.on('sync:error', (error) => {
  console.error('Error sincronizando:', error.message);
});

scanner.start();
