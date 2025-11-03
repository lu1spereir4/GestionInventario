import config from './sync.config.js';

export function listen(onBarcode) {
  const buffer = [];
  const maxLength = config.codeLength;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (chunk) => {
    for (const char of chunk) {
      const code = char.charCodeAt(0);

      // Ctrl+C (carácter 3 en raw mode)
      if (code === 3) {
        process.stdout.write('\n');
        process.exit(0);
      }

      // Enter (CR / LF)
      if (code === 13 || code === 10) {
        emitBarcode(buffer, onBarcode);
        continue;
      }

      buffer.push(char);

      // Cuando llega al tamaño esperado de un Code128, dispara automáticamente
      if (buffer.length >= maxLength) {
        emitBarcode(buffer, onBarcode);
      }
    }
  });
}

function emitBarcode(buffer, callback) {
  if (!buffer.length) {
    return;
  }

  const barcode = buffer.join('').trim();
  buffer.length = 0;

  if (barcode.length === 0) {
    return;
  }

  callback(barcode);
}

