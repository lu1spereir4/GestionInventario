import fs from 'fs';
import { EventEmitter } from 'events';

const SHIFT_CODES = new Set([42, 54]);
const ENTER_CODES = new Set([28, 96]); // 28: KEY_ENTER, 96: KEY_KPENTER

const KEY_MAP = {
  2: '1',
  3: '2',
  4: '3',
  5: '4',
  6: '5',
  7: '6',
  8: '7',
  9: '8',
  10: '9',
  11: '0',
  12: '-',
  13: '=',
  16: 'q',
  17: 'w',
  18: 'e',
  19: 'r',
  20: 't',
  21: 'y',
  22: 'u',
  23: 'i',
  24: 'o',
  25: 'p',
  26: '[',
  27: ']',
  30: 'a',
  31: 's',
  32: 'd',
  33: 'f',
  34: 'g',
  35: 'h',
  36: 'j',
  37: 'k',
  38: 'l',
  39: ';',
  40: '\'',
  41: '`',
  43: '\\',
  44: 'z',
  45: 'x',
  46: 'c',
  47: 'v',
  48: 'b',
  49: 'n',
  50: 'm',
  51: ',',
  52: '.',
  53: '/',
  57: ' ',
  // Keypad digits (muchos escáneres USB los usan)
  71: '7', // KEY_KP7
  72: '8', // KEY_KP8
  73: '9', // KEY_KP9
  75: '4', // KEY_KP4
  76: '5', // KEY_KP5
  77: '6', // KEY_KP6
  79: '1', // KEY_KP1
  80: '2', // KEY_KP2
  81: '3', // KEY_KP3
  82: '0', // KEY_KP0
  83: '.', // KEY_KPDOT
  98: '/', // KEY_KPSLASH
  55: '*', // KEY_KPASTERISK
  74: '-', // KEY_KPMINUS
  78: '+', // KEY_KPPLUS
};

const SHIFTED_KEY_MAP = {
  2: '!',
  3: '@',
  4: '#',
  5: '$',
  6: '%',
  7: '^',
  8: '&',
  9: '*',
  10: '(',
  11: ')',
  12: '_',
  13: '+',
  16: 'Q',
  17: 'W',
  18: 'E',
  19: 'R',
  20: 'T',
  21: 'Y',
  22: 'U',
  23: 'I',
  24: 'O',
  25: 'P',
  26: '{',
  27: '}',
  30: 'A',
  31: 'S',
  32: 'D',
  33: 'F',
  34: 'G',
  35: 'H',
  36: 'J',
  37: 'K',
  38: 'L',
  39: ':',
  40: '"',
  41: '~',
  43: '|',
  44: 'Z',
  45: 'X',
  46: 'C',
  47: 'V',
  48: 'B',
  49: 'N',
  50: 'M',
  51: '<',
  52: '>',
  53: '?',
};

class USBScannerListener extends EventEmitter {
  constructor(devicePath) {
    super();
    this.devicePath = devicePath;
    this.buffer = [];
    this.stream = null;
    this.shiftPressed = false;
    this.flushTimer = null;
  }

  start() {
    try {
      this.stream = fs.createReadStream(this.devicePath);

      this.stream.on('data', (chunk) => {
        this.parseEvents(chunk);
      });

      this.stream.on('error', (error) => {
        if (error.code === 'EACCES') {
          console.error('Permisos insuficientes para leer el dispositivo USB.');
          console.error('Ejecuta el servicio como root o ajusta los permisos del dispositivo.');
        } else {
          console.error(`Error leyendo el dispositivo USB: ${error.message}`);
        }
        this.emit('error', error);
      });

      this.stream.on('close', () => {
        console.log('Stream del dispositivo USB cerrado.');
      });

      console.log(`Listener USB iniciado (dispositivo: ${this.devicePath}).`);
    } catch (error) {
      console.error(`No se pudo iniciar el listener USB: ${error.message}`);
      this.emit('error', error);
    }
  }

  stop() {
    if (this.stream) {
      this.stream.destroy();
      this.stream = null;
      console.log('Listener USB detenido.');
    }
  }

  parseEvents(chunk) {
    // Cada evento de entrada ocupa 24 bytes:
    // timeval (16) + type (2) + code (2) + value (4)
    for (let offset = 0; offset + 24 <= chunk.length; offset += 24) {
      const type = chunk.readUInt16LE(offset + 16);
      const code = chunk.readUInt16LE(offset + 18);
      const value = chunk.readInt32LE(offset + 20);

      if (type !== 1) {
        continue;
      }

      if (SHIFT_CODES.has(code)) {
        this.shiftPressed = value === 1;
        continue;
      }

      if (ENTER_CODES.has(code)) {
        if (value === 0 || value === 1) {
          this.flushBuffer();
        }
        continue;
      }

      if (value !== 1) {
        continue;
      }

      const char = this.shiftPressed
        ? SHIFTED_KEY_MAP[code] || KEY_MAP[code]
        : KEY_MAP[code];

      if (char) {
        this.buffer.push(char);
        this.scheduleFlush();
      }
    }
  }

  flushBuffer() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const barcode = this.buffer.join('').trim();
    this.buffer = [];

    if (!barcode) {
      return;
    }

    console.log(`Código escaneado (USB): ${barcode}`);
    this.emit('scan', barcode);
  }

  scheduleFlush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    // Algunos lectores no envían Enter; hacemos flush tras breve pausa.
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushBuffer();
    }, 120);
  }
}

export default USBScannerListener;
