import fs from 'fs';
import { EventEmitter } from 'events';

// Mapa de códigos de teclas (Linux input event codes)
const KEY_MAP = {
  2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
  16: 'q', 17: 'w', 18: 'e', 19: 'r', 20: 't', 21: 'y', 22: 'u', 23: 'i', 24: 'o', 25: 'p',
  30: 'a', 31: 's', 32: 'd', 33: 'f', 34: 'g', 35: 'h', 36: 'j', 37: 'k', 38: 'l',
  44: 'z', 45: 'x', 46: 'c', 47: 'v', 48: 'b', 49: 'n', 50: 'm',
  12: '-', 13: '=', 26: '[', 27: ']', 39: ';', 40: "'", 41: '`', 43: '\\',
  51: ',', 52: '.', 53: '/', 57: ' '
};

class USBScannerListener extends EventEmitter {
  constructor(devicePath) {
    super();
    this.devicePath = devicePath;
    this.buffer = [];
    this.stream = null;
    this.isShiftPressed = false;
  }

  start() {
    try {
      console.log(`📡 Abriendo dispositivo: ${this.devicePath}`);
      
      this.stream = fs.createReadStream(this.devicePath);
      
      this.stream.on('data', (data) => {
        this.parseEvent(data);
      });

      this.stream.on('error', (err) => {
        console.error('❌ Error leyendo dispositivo:', err.message);
        if (err.code === 'EACCES') {
          console.error('⚠️  Necesitas permisos root. Ejecuta con: sudo node usbListener.js');
        }
        this.emit('error', err);
      });

      this.stream.on('end', () => {
        console.log('ℹ️  Stream del dispositivo cerrado');
      });

      console.log('✅ Listener USB iniciado correctamente');
      console.log('📷 Esperando escaneos...');
      
    } catch (error) {
      console.error('❌ Error al iniciar listener:', error.message);
      this.emit('error', error);
    }
  }

  parseEvent(data) {
    // Linux input event structure: 24 bytes
    // timestamp (8 bytes) + type (2) + code (2) + value (4) + padding
    
    for (let i = 0; i < data.length; i += 24) {
      if (i + 24 > data.length) break;

      const type = data.readUInt16LE(i + 16);
      const code = data.readUInt16LE(i + 18);
      const value = data.readInt32LE(i + 20);

      // Type 1 = EV_KEY (eventos de teclado)
      if (type === 1) {
        // Value 1 = key press, 0 = key release
        if (value === 1) {
          this.handleKeyPress(code);
        }
      }
    }
  }

  handleKeyPress(code) {
    // Detectar Enter (código 28)
    if (code === 28) {
      if (this.buffer.length > 0) {
        const barcode = this.buffer.join('');
        console.log(`📦 Código escaneado: ${barcode}`);
        this.emit('scan', barcode);
        this.buffer = [];
      }
      return;
    }

    // Detectar Shift (códigos 42 y 54)
    if (code === 42 || code === 54) {
      this.isShiftPressed = true;
      return;
    }

    // Convertir código a carácter
    const char = KEY_MAP[code];
    if (char) {
      // Si shift está presionado, convertir a mayúscula
      const finalChar = this.isShiftPressed ? char.toUpperCase() : char;
      this.buffer.push(finalChar);
    }

    // Reset shift después de usar
    this.isShiftPressed = false;
  }

  stop() {
    if (this.stream) {
      this.stream.destroy();
      console.log('🛑 Listener USB detenido');
    }
  }
}

export default USBScannerListener;
