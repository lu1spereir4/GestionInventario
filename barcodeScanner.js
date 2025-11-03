import config from './sync.config.js';

export function listen(onBarcode) {
  const buffer = [];
  const maxLength = config.codeLength;

  console.log('🔧 Configurando lector de códigos de barras...');

  // Verificar si stdin es un TTY (terminal interactivo)
  if (process.stdin.isTTY) {
    console.log('✅ Modo TTY - Escáner físico activo');
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

        // Cuando llega al tamaño esperado, dispara automáticamente
        if (buffer.length >= maxLength) {
          emitBarcode(buffer, onBarcode);
        }
      }
    });
  } else {
    // Modo no-TTY: común en Windows o cuando se ejecuta con npm/concurrently
    console.log('✅ Modo no-TTY - Escribe códigos manualmente');
    console.log('💡 En Linux/Raspberry Pi con terminal directo funcionará automáticamente');
    
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    
    let lineBuffer = '';
    
    process.stdin.on('data', (data) => {
      lineBuffer += data.toString();
      const lines = lineBuffer.split('\n');
      
      // Procesar todas las líneas completas
      for (let i = 0; i < lines.length - 1; i++) {
        const barcode = lines[i].trim();
        if (barcode.length > 0) {
          console.log(`📷 Código capturado: ${barcode}`);
          onBarcode(barcode);
        }
      }
      
      // Mantener la última línea incompleta en el buffer
      lineBuffer = lines[lines.length - 1];
    });

    // Procesar Ctrl+C en modo no-TTY
    process.on('SIGINT', () => {
      console.log('\n👋 Cerrando servidor...');
      process.exit(0);
    });
  }
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

  console.log(`📷 Código procesado: ${barcode}`);
  callback(barcode);
}

