# 🛒 Sistema de Gestión de Inventario

Sistema de punto de venta con lector de códigos de barras diseñado para Raspberry Pi.

## 📋 Características

- ✅ **Escaneo automático** de productos con lector de códigos de barras
- 📊 **Dashboard en tiempo real** con ventas del día
- 💰 **Precios fijos y variables** según categoría de producto
- 🔄 **Sincronización automática** con backend central
- 📱 **Interfaz táctil** optimizada para Raspberry Pi
- 🔌 **WebSocket** para actualizaciones en tiempo real
- 💾 **Base de datos SQLite** local con sincronización diferida

## 🚀 Instalación

### Requisitos previos

- Node.js 18+ instalado
- Lector de códigos de barras USB
- Conexión de red al servidor backend

### Paso 1: Instalar dependencias

```bash
npm run install-all
```

Este comando instalará las dependencias tanto del backend como del frontend.

### Paso 2: Configurar el sistema

Edita el archivo `sync.config.js` con tus configuraciones:

```javascript
export default {
  apiBase: 'http://192.168.1.47:3000/api/inventario', // URL de tu backend
  deviceId: 'pi-almacen-01',                          // ID único del dispositivo
  jwt: null,                                          // Token JWT si es necesario
  codeLength: 12,                                     // Longitud de códigos de barras
  syncIntervalMs: 60_000,                             // Intervalo de sincronización
  dbFile: './inventory-sync.db'                       // Archivo de base de datos
};
```

## 🎯 Uso

### Desarrollo (Backend + Frontend)

Para ejecutar el sistema completo en modo desarrollo:

```bash
npm run dev
```

Esto iniciará:
- **Backend**: `http://localhost:3001`
- **Frontend**: `http://localhost:5173`

### Solo Backend (modo terminal)

Para usar solo el ingestor original sin interfaz gráfica:

```bash
npm run ingestor
```

### Solo Servidor con API

Para ejecutar solo el servidor con API y WebSocket:

```bash
npm run server
```

### Solo Frontend

Para ejecutar solo el frontend (el backend debe estar corriendo):

```bash
npm run frontend
```

## 📱 Interfaz de Usuario

### Panel Principal

El dashboard muestra:

1. **Indicador de conexión**: Estado de la conexión con el servidor
2. **Resumen de ventas**: Total de productos y monto vendido del día
3. **Lista de ventas**: Productos escaneados en tiempo real

### Modal de Precio Variable

Cuando se escanea un producto de categoría "Varios":

1. Se abre automáticamente un modal
2. Ingresar el precio manualmente o seleccionar un precio rápido
3. Confirmar la venta

## 🔧 Estructura del Proyecto

```
GestionInventario/
├── server.js              # Servidor Express con WebSocket
├── ingestor.js            # Ingestor original (modo terminal)
├── barcodeScanner.js      # Módulo de escaneo de códigos
├── db.js                  # Operaciones de base de datos SQLite
├── sync.config.js         # Configuración del sistema
├── package.json           # Dependencias del backend
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Componente principal
│   │   ├── components/
│   │   │   ├── ConnectionStatus.jsx
│   │   │   ├── SummaryCard.jsx
│   │   │   ├── SalesList.jsx
│   │   │   └── VariablePriceModal.jsx
│   │   └── ...
│   ├── package.json       # Dependencias del frontend
│   └── vite.config.js     # Configuración de Vite
└── README.md
```

## 🔌 API Endpoints

### GET `/api/sales/today`

Obtiene las ventas del día actual.

**Respuesta:**
```json
{
  "totalItems": 15,
  "totalCents": 45000,
  "sales": [...]
}
```

### GET `/api/pending-variable-price`

Obtiene el scan pendiente que requiere precio variable.

### POST `/api/set-variable-price`

Envía el precio para un producto de categoría "Varios".

**Body:**
```json
{
  "scanId": "uuid",
  "priceCents": 1500
}
```

## 📡 Eventos WebSocket

### Cliente → Servidor

No hay eventos enviados por el cliente (solo consume).

### Servidor → Cliente

- `connect`: Conexión establecida
- `initial-data`: Datos iniciales al conectar
- `scan-received`: Nuevo código escaneado
- `sale-completed`: Venta confirmada
- `variable-price-required`: Producto requiere precio manual
- `sale-rejected`: Venta rechazada por el backend
- `sync-error`: Error en sincronización

## 🏗️ Producción en Raspberry Pi

### 1. Clonar el repositorio

```bash
cd ~
git clone <tu-repositorio>
cd GestionInventario
```

### 2. Instalar dependencias

```bash
npm run install-all
```

### 3. Construir el frontend

```bash
npm run build
```

### 4. Configurar inicio automático

Crear servicio systemd en `/etc/systemd/system/inventory.service`:

```ini
[Unit]
Description=Sistema de Inventario
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/GestionInventario
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Habilitar e iniciar el servicio:

```bash
sudo systemctl enable inventory
sudo systemctl start inventory
```

### 5. Configurar Chromium en modo kiosk

Editar `/etc/xdg/lxsession/LXDE-pi/autostart`:

```
@chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3001
```

## 🐛 Resolución de Problemas

### El escáner no funciona

- Verificar que el dispositivo USB esté conectado
- Comprobar permisos: `ls -l /dev/input/`
- El escáner debe estar configurado para enviar Enter después del código

### No se conecta al backend

- Verificar la URL en `sync.config.js`
- Comprobar conectividad: `ping <ip-del-backend>`
- Revisar logs del servidor backend

### Frontend no carga

- Verificar que el puerto 3001 esté abierto
- Comprobar que el servidor esté corriendo: `ps aux | grep node`
- Ver logs: `sudo journalctl -u inventory -f`

## 📝 Logs

Los logs del sistema se guardan en:

- `synced.log`: Ventas sincronizadas exitosamente
- `rejected.log`: Ventas rechazadas por el backend

## 🔐 Seguridad

Para proteger la API:

1. Configurar JWT en `sync.config.js`
2. El token se incluirá automáticamente en las peticiones
3. El backend debe validar el token en cada request

## 🎨 Personalización

### Modificar categorías de productos

Editar emojis en `frontend/src/components/SalesList.jsx`:

```javascript
const getCategoryEmoji = (category) => {
  const emojis = {
    'bebida_latas': '🥤',
    'pasteleria': '🧁',
    // ... agregar más categorías
  };
  return emojis[category] || '📦';
};
```

### Ajustar precios rápidos

Editar en `frontend/src/components/VariablePriceModal.jsx`:

```javascript
{[0.50, 1.00, 2.00, 5.00, 10.00, 20.00].map((amount) => (
  // ... modificar montos
))}
```

## 📄 Licencia

ISC

## 👨‍💻 Soporte

Para problemas o preguntas, crear un issue en el repositorio.
