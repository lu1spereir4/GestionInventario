# Inventory Management System — POS con Lector de Código de Barras

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socket.io&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local--first-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-3B+-A22846?style=flat-square&logo=raspberry-pi&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)

Sistema de punto de venta (POS) de producción diseñado para operar en hardware embebido (Raspberry Pi 3B+). Integra captura de códigos de barras por USB, sincronización con un backend central mediante REST + WebSocket, y una interfaz táctil optimizada para pantallas de bajo consumo.

---

## Tabla de Contenidos

- [Motivación y Arquitectura](#motivación-y-arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Características](#características)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Inicio Rápido](#inicio-rápido)
- [Configuración](#configuración)
- [API Reference](#api-reference)
- [Eventos WebSocket](#eventos-websocket)
- [Despliegue en Producción (Raspberry Pi)](#despliegue-en-producción-raspberry-pi)
- [Resolución de Problemas](#resolución-de-problemas)
- [Seguridad](#seguridad)

---

## Motivación y Arquitectura

El sistema resuelve el problema de operar un punto de venta en entornos con **conectividad intermitente**. En lugar de depender de una conexión permanente al backend, cada dispositivo mantiene una base de datos SQLite local que actúa como fuente de verdad inmediata, sincronizándose con el servidor central en segundo plano.

```
┌───────────────────────────────┐         ┌─────────────────────┐
│        Raspberry Pi           │         │   Backend Central   │
│                               │         │                     │
│  ┌──────────┐  ┌───────────┐  │  REST   │  ┌─────────────┐   │
│  │  Escáner │→ │ server.js │ ←┼────────→│  │   API /     │   │
│  │  USB HID │  │ Express + │  │WebSocket│  │  inventario │   │
│  └──────────┘  │ Socket.IO │  │         │  └─────────────┘   │
│                └─────┬─────┘  │         └─────────────────────┘
│                      │        │
│               ┌──────▼──────┐ │
│               │  SQLite DB  │ │
│               │  (local)    │ │
│               └─────────────┘ │
│                               │
│  ┌──────────────────────────┐ │
│  │   React + Vite (kiosk)   │ │
│  │   Chromium en modo kiosk │ │
│  └──────────────────────────┘ │
└───────────────────────────────┘
```

---

## Stack Tecnológico

| Capa | Tecnología | Propósito |
|---|---|---|
| **Backend** | Node.js 18 + Express 4 | Servidor HTTP y API REST |
| **Tiempo real** | Socket.IO 4 | Push de eventos al frontend |
| **Base de datos** | SQLite (`better-sqlite3`) | Persistencia local sin servidor |
| **Frontend** | React 18 + Vite 5 | Interfaz táctil reactiva |
| **Sincronización** | Axios + interval | Sync diferido con backend central |
| **Hardware** | Raspberry Pi 3B+ | Dispositivo de despliegue objetivo |
| **Entrada HID** | Node.js readline / USB | Captura del escáner de barras |
| **Subida de imgs** | Multer | Imágenes de producto por producto |

---

## Características

- **Escaneo USB automático** — captura eventos HID del lector sin depender de foco de teclado
- **Dashboard en tiempo real** — ventas del día actualizadas vía WebSocket sin polling
- **Soporte de precios variables** — modal para productos de precio libre (categoría "Varios")
- **Sincronización diferida** — opera offline y sincroniza en cuanto hay conectividad
- **Catálogo remoto** — descarga y cachea el catálogo desde el endpoint central
- **Gestión de imágenes de producto** — carga, sirve y propaga imágenes vía WebSocket
- **Interfaz kiosk** — UI táctil optimizada para pantallas pequeñas y uso continuo
- **Inicio automático** — configuración lista para `systemd` + Chromium en modo kiosk

---

## Estructura del Proyecto

```
GestionInventario/
├── server.js              # Servidor principal: Express + Socket.IO + escáner USB
├── server-no-scanner.js   # Variante sin hardware (desarrollo en PC)
├── ingestor.js            # Modo CLI legacy (terminal sin interfaz gráfica)
├── barcodeScanner.js      # Módulo de captura HID / readline
├── usbScanner.js          # Detección y lectura directa del dispositivo USB
├── db.js                  # DAL: operaciones SQLite (ventas, catálogo, imágenes)
├── sync.config.js         # Configuración centralizada (URL backend, deviceId, JWT...)
├── check-db.js            # Utilidad de inspección de la base de datos
├── package.json
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx                        # Componente raíz y orquestación de estado
        └── components/
            ├── ConnectionStatus.jsx       # Indicador de estado de conexión
            ├── SummaryCard.jsx            # Totales del día (unidades + monto)
            ├── SalesList.jsx              # Lista de ventas en tiempo real
            ├── VariablePriceModel.jsx     # Modal de precio libre
            ├── AnalyticsPanel.jsx         # Panel de métricas y tendencias
            ├── ManualScanner.jsx          # Entrada manual de código de barras
            ├── ProductImageManager.jsx    # Gestión de imágenes por producto
            ├── ScanSimulator.jsx          # Simulador de escaneo (desarrollo)
            ├── ScannerToggle.jsx          # Activar/desactivar escáner físico
            ├── ConfirmDialog.jsx          # Diálogo de confirmación genérico
            └── Toast.jsx                 # Notificaciones no bloqueantes
```

---

## Inicio Rápido

### Prerequisitos

- Node.js ≥ 18
- npm ≥ 9
- (Producción) Lector de códigos de barras USB HID

### 1. Clonar e instalar

```bash
git clone <url-del-repositorio>
cd GestionInventario
npm run install-all
```

### 2. Configurar

Edita el archivo `sync.config.js` con tus parámetros:

```js
export default {
  apiBase:        'http://192.168.1.47:3000/api/inventario', // URL del backend central
  catalogEndpoint: 'http://192.168.1.47:3000/api/catalogo',  // Endpoint del catálogo
  deviceId:       'pi-almacen-01',    // ID único del dispositivo (se envía en cada sync)
  jwt:            null,               // Token JWT (opcional, ver sección Seguridad)
  codeLength:     12,                 // Longitud esperada de los códigos de barras
  syncIntervalMs: 60_000,             // Intervalo de sincronización en ms (60 s por defecto)
  dbFile:         './inventory-sync.db'
};
```

### 3. Ejecutar en desarrollo

```bash
# Backend (sin escáner físico) + Frontend con hot-reload
npm run dev
```

| Servicio | URL |
|---|---|
| Backend API | http://localhost:3001 |
| Frontend (Vite) | http://localhost:5173 |

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Backend sin escáner + frontend (desarrollo) |
| `npm run dev-with-scanner` | Backend con escáner USB + frontend |
| `npm run server` | Solo backend con escáner |
| `npm run server-no-scanner` | Solo backend sin escáner |
| `npm run frontend` | Solo frontend (requiere backend activo) |
| `npm run build` | Build de producción del frontend |
| `npm run ingestor` | Modo CLI legacy (sin interfaz) |
| `npm run check-db` | Inspeccionar el estado de la base de datos |
| `npm run clear-db` | Eliminar la base de datos local |

---

## Configuración

Todos los parámetros del sistema se centralizan en `sync.config.js`:

```js
export default {
  apiBase:         'http://192.168.1.47:3000/api/inventario',
  catalogEndpoint: 'http://192.168.1.47:3000/api/catalogo',
  deviceId:        'pi-almacen-01',   // ID único del dispositivo
  jwt:             null,              // Token JWT (ver sección Seguridad)
  codeLength:      12,
  syncIntervalMs:  60_000,            // 60 segundos
  dbFile:          './inventory-sync.db'
};
```

---

## API Reference

### `GET /api/sales/today`

Ventas registradas en el día actual.

```jsonc
// 200 OK
{
  "totalItems": 15,
  "totalCents": 45000,
  "sales": [
    {
      "id": "uuid",
      "barcode": "750100012345",
      "name": "Refresco 355ml",
      "category": "bebida_latas",
      "priceCents": 2500,
      "createdAt": "2026-02-27T14:32:00.000Z"
    }
  ]
}
```

### `GET /api/pending-variable-price`

Retorna el scan pendiente que requiere asignación manual de precio (si existe).

```jsonc
// 200 OK — hay uno pendiente
{ "scanId": "uuid", "barcode": "7501..." }

// 200 OK — no hay pendientes
{ "scanId": null }
```

### `POST /api/set-variable-price`

Asigna precio a un producto de categoría variable y registra la venta.

```jsonc
// Body
{ "scanId": "uuid", "priceCents": 1500 }

// 200 OK
{ "ok": true }
```

### `POST /api/images/:barcode`

Sube una imagen para un producto. Acepta `multipart/form-data` con campo `image`.
Las imágenes se almacenan en `public/images/` y se sirven bajo `/images/:filename`.

---

## Eventos WebSocket

El servidor emite eventos a todos los clientes conectados en tiempo real.

| Evento | Dirección | Payload | Descripción |
|---|---|---|---|
| `initial-data` | Server → Client | `{ sales, pendingVariablePrice }` | Datos iniciales al conectar |
| `scan-received` | Server → Client | `{ barcode }` | Código escaneado recibido |
| `sale-completed` | Server → Client | `Sale` | Venta confirmada con éxito |
| `variable-price-required` | Server → Client | `{ scanId, barcode }` | Requiere precio manual |
| `sale-rejected` | Server → Client | `{ reason }` | Venta rechazada por el backend |
| `sync-error` | Server → Client | `{ message }` | Error en sincronización |
| `image-updated` | Server → Client | `{ barcode, imageUrl }` | Nueva imagen disponible |

> El cliente no emite eventos; consume el stream del servidor.

---

## Despliegue en Producción (Raspberry Pi)

### 1. Preparar el dispositivo

```bash
cd ~
git clone <url-del-repositorio> GestionInventario
cd GestionInventario
npm run install-all
npm run build
```

### 2. Configurar servicio systemd

Crear `/etc/systemd/system/inventory.service`:

```ini
[Unit]
Description=Sistema de Inventario POS
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/GestionInventario
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable inventory
sudo systemctl start inventory
sudo systemctl status inventory
```

### 3. Configurar Chromium en modo kiosk

Editar `/etc/xdg/lxsession/LXDE-pi/autostart`:

```
@chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble http://localhost:3001
```

### 4. Verificar logs en tiempo real

```bash
sudo journalctl -u inventory -f
```

---

## Resolución de Problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| Escáner no detectado | Permisos del dispositivo USB | `ls -l /dev/input/` y verificar grupo `input` |
| No conecta al backend | URL incorrecta o red caída | Revisar `sync.config.js` y hacer `ping <ip-backend>` |
| Frontend no carga | Puerto 3001 bloqueado o servidor caído | `ps aux \| grep node` y `sudo journalctl -u inventory` |
| Imágenes no aparecen | Directorio `public/images` sin permisos | `chmod -R 755 public/` |

---

## Seguridad

El sistema soporta autenticación JWT para la sincronización con el backend:

1. Establecer el token en `sync.config.js` → campo `jwt`
2. El token se adjunta automáticamente como `Authorization: Bearer <token>` en cada petición de sincronización
3. El backend central es responsable de validar y rotar el token

---

## Licencia

[ISC](https://opensource.org/licenses/ISC) © 2026

