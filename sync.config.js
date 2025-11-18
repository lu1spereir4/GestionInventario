export default {
  apiBase: 'http://192.168.1.113:3000/api/inventario', // Cambia al host/IP real de tu backend
  deviceId: 'pi-almacen-01',                          // Identificador que verás en la API
  jwt: null,                                          // Pon un token aquí si decides proteger la API
  codeLength: 12,                                     // Tus Code128 generados tienen 12 caracteres (2 prefijo + 8 random + 2 checksum)
  syncIntervalMs: 60_000,                             // Reintenta cada 60 segundos
  catalogEndpoint: '/products',                       // Endpoint relativo para obtener catálogo
  catalogRefreshMs: 10 * 60_000,                      // Actualiza catálogo cada 10 minutos
  dbFile: './inventory-sync.db'                       // Archivo SQLite local
};

