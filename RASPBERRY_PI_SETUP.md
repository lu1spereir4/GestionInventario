# Raspberry Pi Deployment Guide

Esta guía resume los pasos necesarios para poner en producción el sistema con
un lector USB (probado con el MP5100) en una Raspberry Pi u otra distribución
Linux similar.

---

## 1. Prerrequisitos

- Raspberry Pi OS (Bullseye o Bookworm) actualizado.
- Conexión a internet para instalar dependencias.
- Lector de códigos de barras USB (modo HID, envía teclas).
- Git, curl y build-essential instalados:
  ```bash
  sudo apt update
  sudo apt install -y git curl build-essential python3
  ```

---

## 2. Instalar Node.js 20 con nvm (recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install v20.19.5
nvm use v20.19.5
```

Comprueba:

```bash
node -v
npm -v
```

> Usa siempre esta versión al instalar dependencias o al reconstruir módulos
> nativos (por ejemplo, `better-sqlite3`).

---

## 3. Clonar el proyecto e instalar dependencias

```bash
git clone <REPO_URL> inventory-sync
cd inventory-sync
npm install           # backend
cd frontend
npm install           # frontend
cd ..
```

Si migras un proyecto ya existente desde Windows, elimina `node_modules`
anteriores y ejecuta los `npm install` dentro de la Raspberry para que se
recompilen los módulos nativos.

---

## 4. Configurar el lector USB

1. Conecta el escáner y averigua su ruta estable:
   ```bash
   ls -l /dev/input/by-id/
   ```
   El enlace suele verse como `usb-<vendor>_<model>-event-kbd`. Ejemplo:
   ```
   /dev/input/by-id/usb-Linux_3.0.8-svn379_with_dwc2-gadget_HID_Gadget-event-kbd
   ```

2. Otorga permisos al usuario que correrá el servicio (`pi`, `lu1s`, etc.):
   ```bash
   sudo setfacl -m u:$USER:rw /dev/input/by-id/<tu-evento>
   ```
   Para que el permiso persista tras reinicios, puedes crear una regla udev o
   añadir al usuario al grupo `input`:
   ```bash
   sudo usermod -a -G input $USER
   ```
   (requiere cerrar sesión).

3. Comprueba que el lector emita eventos (opcional):
   ```bash
   sudo evtest /dev/input/by-id/<tu-evento>
   ```

---

## 5. Ajustar `sync.config.js`

Edita `sync.config.js` y define:

```javascript
export default {
  apiBase: 'http://IP_DEL_BACKEND:3000/api/inventario',
  deviceId: 'pi-almacen-01',
  jwt: null,
  codeLength: 12,
  syncIntervalMs: 60_000,
  dbFile: './inventory-sync.db'
};
```

---

## 6. Script de arranque (incluye soporte para nvm)

Asegúrate de tener `start-inventory-service.sh` así:

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[inventory-sync]"

log() {
  printf '%s %s\n' "$LOG_PREFIX" "$*"
}

if [ -z "${NVM_DIR:-}" ] && [ -d "$HOME/.nvm" ]; then
  export NVM_DIR="$HOME/.nvm"
fi

if [ -n "${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use --silent >/dev/null 2>&1 || true
fi

NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  log "Node.js no está disponible. Ajusta NODE_BIN."
  exit 1
fi

if [ -z "${USB_SCANNER_DEVICE:-}" ] || [ ! -e "$USB_SCANNER_DEVICE" ]; then
  log "Configura USB_SCANNER_DEVICE con el enlace /dev/input/by-id/... válido."
  exit 1
fi

cd "$PROJECT_DIR"
log "Iniciando servidor (Node: $NODE_BIN, USB: $USB_SCANNER_DEVICE)"

cleanup() {
  local status=$?
  if [ -n "${SERVER_PID:-}" ]; then
    log "Deteniendo servidor (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  exit $status
}

trap cleanup INT TERM

"$NODE_BIN" server.js &
SERVER_PID=$!
wait "$SERVER_PID"
```

Hazlo ejecutable:

```bash
chmod +x start-inventory-service.sh
```

---

## 7. Unidad systemd

Guarda la siguiente unidad en `/etc/systemd/system/inventory-sync.service`:

```ini
[Unit]
Description=Inventory Sync Server with USB barcode listener
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi                  # cambia según el usuario elegido
Group=pi                 # idem
WorkingDirectory=/home/pi/inventory-sync
Environment=USB_SCANNER_DEVICE=/dev/input/by-id/usb-...-event-kbd
Environment=NODE_ENV=production
ExecStart=/usr/bin/env USB_SCANNER_DEVICE=/dev/input/by-id/usb-...-event-kbd /home/pi/.nvm/versions/node/v20.19.5/bin/node server.js
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

> Sustituye `pi` por el usuario real, y actualiza la ruta `USB_SCANNER_DEVICE`
> y el binario de Node si es distinto. Si prefieres reutilizar el script de la
> sección anterior, cambia `ExecStart` a:
> ```
> ExecStart=/usr/bin/env USB_SCANNER_DEVICE=/dev/input/by-id/... NODE_BIN=/home/pi/.nvm/versions/node/v20.19.5/bin/node /home/pi/inventory-sync/start-inventory-service.sh
> ```

Activa el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable inventory-sync.service
sudo systemctl start inventory-sync.service
sudo journalctl -u inventory-sync.service -f   # para monitorear
```

---

## 8. Frontend (Vite)

En otra terminal:

```bash
cd ~/inventory-sync/frontend
npm run dev -- --host 0.0.0.0
```

Accede desde la Pi (o en la red local) a `http://<IP>:5173`. El backend expone
WebSocket y API REST en el puerto `3001`.

---

## 9. Notas sobre el lector MP5100

- Algunos modelos no envían `Enter` al final del código. El módulo
  `usbScanner.js` incluye una cola que hace *flush* automático tras 120 ms de
  inactividad, por lo que no necesitas configurar el lector manualmente.
- Si cambias de lector y notas problemas:
  1. Corre `sudo evtest /dev/input/by-id/...` para ver qué `code` y `value`
     produce.
  2. Ajusta `KEY_MAP`, `ENTER_CODES` o el timeout en `usbScanner.js` según
     la información recogida.

---

## 10. Verificación rápida

1. `sudo systemctl status inventory-sync.service` → debe estar `active`.
2. `sudo journalctl -u inventory-sync.service -f` → al escanear se ve:
   ```
   Código escaneado (USB): 1234567890
   ```
3. El dashboard (`http://<IP>:5173`) muestra la venta en la lista y resume el
   total.

---

## 11. Mantenimiento

- Sincronización: los registros se guardan en SQLite (`inventory-sync.db`) y se
  suben al backend cada `syncIntervalMs`.
- Logs: revisa `synced.log` / `rejected.log` para depurar la comunicación con el
  backend central.
- Reconstrucciones: si actualizas Node, vuelve a ejecutar
  `npm rebuild better-sqlite3 --build-from-source`.

---

Listo. Con estos pasos el sistema queda funcionando en segundo plano (systemd)
capturando el escáner USB sin necesidad de mantener una terminal abierta.
