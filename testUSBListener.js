import USBScannerListener from './usbScanner.js';
import axios from 'axios';

// Configuración
const DEVICE_PATH = process.argv[2] || '/dev/input/event0';
const SERVER_URL = 'http://localhost:3001/api/scan';

console.log(`
╔═══════════════════════════════════════════╗
║  📡 Listener USB para Escáner de Barras  ║
╚═══════════════════════════════════════════╝
`);

console.log(`Dispositivo: ${DEVICE_PATH}`);
console.log(`Servidor: ${SERVER_URL}`);
console.log('');

// Crear listener
const listener = new USBScannerListener(DEVICE_PATH);

// Cuando se escanea un código
listener.on('scan', async (barcode) => {
  console.log(`✅ Código capturado: ${barcode}`);
  
  try {
    // Enviar al servidor
    const response = await axios.post(SERVER_URL, { barcode });
    
    if (response.status === 200) {
      console.log(`📤 Enviado al servidor correctamente`);
    } else {
      console.error(`⚠️  Respuesta del servidor: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Error enviando al servidor: ${error.message}`);
  }
  
  console.log('---');
});

// Manejar errores
listener.on('error', (error) => {
  console.error('❌ Error en el listener:', error.message);
  process.exit(1);
});

// Iniciar
listener.start();

// Manejar Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Deteniendo listener...');
  listener.stop();
  process.exit(0);
});

console.log('');
console.log('💡 IMPORTANTE:');
console.log('   - Si ves "Permission denied", ejecuta con: sudo');
console.log('   - Si no detecta escaneos, prueba otro /dev/input/eventX');
console.log('   - Escanea un código para probar');
console.log('');
