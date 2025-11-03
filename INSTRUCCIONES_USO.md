# 📖 Instrucciones de Uso

## 🚀 Iniciar el Sistema con Escáner USB

Para que el lector de códigos de barras funcione correctamente, debes ejecutar el backend y frontend en terminales separados:

### Opción 1: Dos Terminales Separados (RECOMENDADO para Raspberry Pi con escáner)

#### Terminal 1 - Backend:
```bash
cd /c/Users/luis/Desktop/GestionInventario
npm run server
```

**Salida esperada:**
```
╔═══════════════════════════════════════════╗
║  🚀 Servidor de Inventario Iniciado      ║
║                                           ║
║  Puerto: 3001                            ║
║  WebSocket: Activo                        ║
║  Escáner: Listo                          ║
╚═══════════════════════════════════════════╝

⚠️  Modo no-TTY detectado. El escáner de códigos funcionará en modo línea.
💡 Para usar el escáner USB directamente, ejecuta: node server.js
```

#### Terminal 2 - Frontend:
```bash
cd /c/Users/luis/Desktop/GestionInventario
npm run frontend
```

**Salida esperada:**
```
VITE v5.4.21  ready in 201 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.47:5173/
```

### Opción 2: Un Solo Terminal (sin escáner físico)

Si solo quieres probar el frontend sin escáner:

```bash
npm run dev
```

Luego puedes simular escaneos escribiendo códigos manualmente en el Terminal 1.

## 🔍 Verificar que el Escáner Funciona

### 1. Verificar conexión del escáner USB

En el terminal donde corre el servidor, deberías poder escanear un código y ver:

```
📦 Lectura registrada: [CODIGO_ESCANEADO]
```

### 2. Verificar sincronización con backend

Si el backend está configurado correctamente en `sync.config.js`, verás:

```
✔ Enviados: 1
```

O si es un producto "Varios":

```
⚠️  Precio variable requerido para: Varios
```

### 3. Verificar en el frontend

Abre el navegador en `http://localhost:5173` y deberías ver:
- ✅ Indicador "Conectado" en verde
- 📦 El producto aparecer en la lista de ventas
- 💰 El total actualizado

## 🐛 Solución de Problemas

### El escáner no envía códigos

**Problema:** Escáneas pero no aparece nada en el terminal del servidor.

**Solución:**
1. Verifica que el escáner está enchufado
2. El escáner debe estar configurado para enviar "Enter" después del código
3. Intenta escribir manualmente un código y presionar Enter
4. Si funciona manualmente pero no con el escáner, verifica la configuración del lector

### Los códigos se envían pero no aparecen en el frontend

**Problema:** Ves `POST /api/inventario/scans/bulk 200` en los logs pero el frontend no se actualiza.

**Soluciones:**

1. **Verificar conexión WebSocket:**
   - Abre la consola del navegador (F12)
   - Busca mensajes de Socket.IO
   - Deberías ver: `✅ Conectado al servidor`

2. **Verificar respuesta del backend:**
   - El backend debe responder con `acceptedIds` o `variablePriceRequired`
   - Revisa los logs del terminal del servidor
   - Si no ves `✔ Enviados: X`, el backend no está aceptando los scans

3. **Configuración del backend:**
   - Verifica que `sync.config.js` tiene la URL correcta del backend
   - El backend debe estar corriendo y accesible
   - Prueba: `curl http://192.168.1.47:3000/api/inventario/scans/bulk`

### El frontend muestra "Desconectado"

**Problema:** El indicador de conexión está en rojo.

**Soluciones:**
1. Verifica que el servidor está corriendo en el puerto 3001
2. Abre la consola del navegador y busca errores de conexión
3. Verifica que no hay un firewall bloqueando el puerto 3001
4. En Raspberry Pi, asegúrate de que el servidor y frontend están en la misma red

### Productos "Varios" no muestran el modal

**Problema:** Escáneas un producto "Varios" pero no aparece el modal para ingresar precio.

**Solución:**
El backend debe responder con:
```json
{
  "acceptedIds": [],
  "rejected": [],
  "variablePriceRequired": [
    {
      "id": "uuid-del-scan",
      "productName": "Varios",
      "category": "varios"
    }
  ]
}
```

Verifica la respuesta del backend en los logs del servidor.

## 📊 Estructura de Respuestas del Backend

### Para productos con precio fijo:

El backend debe aceptar el scan directamente:

```json
{
  "acceptedIds": ["uuid-del-scan"],
  "rejected": []
}
```

El servidor local marcará el scan como sincronizado y emitirá el evento `sale-completed` al frontend.

### Para productos "Varios" (precio variable):

El backend debe indicar que requiere precio:

```json
{
  "acceptedIds": [],
  "rejected": [],
  "variablePriceRequired": [
    {
      "id": "uuid-del-scan",
      "productName": "Varios",
      "category": "varios",
      "barcode": "codigo-escaneado"
    }
  ]
}
```

El servidor local:
1. Guardará el scan como pendiente
2. Emitirá el evento `variable-price-required` al frontend
3. El frontend mostrará el modal
4. Cuando el usuario ingrese el precio, se enviará nuevamente al backend con el campo `variablePriceCents`

### Scans rechazados:

```json
{
  "acceptedIds": [],
  "rejected": [
    {
      "id": "uuid-del-scan",
      "reason": "Producto no encontrado"
    }
  ]
}
```

El servidor local marcará el scan como rechazado y lo registrará en `rejected.log`.

## 🎯 Flujo Completo

```
1. Usuario escanea código
   ↓
2. barcodeScanner.js captura el código
   ↓
3. server.js recibe el código via addScan()
   ↓
4. Se guarda en SQLite local
   ↓
5. Se emite evento WebSocket: "scan-received"
   ↓
6. Se intenta sincronizar con backend (triggerSync)
   ↓
7a. Backend acepta → "sale-completed" → Frontend muestra venta
   ↓
7b. Backend requiere precio → "variable-price-required" → Modal
   ↓
8. Usuario ingresa precio → POST /api/set-variable-price
   ↓
9. Se envía al backend con variablePriceCents
   ↓
10. Backend acepta → "sale-completed" → Frontend muestra venta
```

## 🔧 Configuración de Producción en Raspberry Pi

### 1. Instalar como servicio systemd

Crear `/etc/systemd/system/inventory-server.service`:

```ini
[Unit]
Description=Inventory Scanner Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/GestionInventario
ExecStart=/usr/bin/node server.js
Restart=always
StandardInput=tty
TTYPath=/dev/tty1

[Install]
WantedBy=multi-user.target
```

Habilitar e iniciar:
```bash
sudo systemctl enable inventory-server
sudo systemctl start inventory-server
```

### 2. Frontend como servicio

Crear `/etc/systemd/system/inventory-frontend.service`:

```ini
[Unit]
Description=Inventory Frontend
After=network.target inventory-server.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/GestionInventario/frontend
ExecStart=/usr/bin/npm run dev
Restart=always

[Install]
WantedBy=multi-user.target
```

### 3. Chromium en modo kiosk

Editar `/etc/xdg/lxsession/LXDE-pi/autostart`:

```
@xset s off
@xset -dpms
@xset s noblank
@chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble http://localhost:5173
```

## 📝 Logs y Debugging

### Ver logs del servidor:
```bash
sudo journalctl -u inventory-server -f
```

### Ver logs del frontend:
```bash
sudo journalctl -u inventory-frontend -f
```

### Ver logs locales:
```bash
# Ventas sincronizadas
cat synced.log

# Ventas rechazadas
cat rejected.log
```

### Ver base de datos SQLite:
```bash
sqlite3 inventory-sync.db "SELECT * FROM scans ORDER BY scanned_at DESC LIMIT 10;"
```
