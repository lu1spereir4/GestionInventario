% This file is written in UTF-8
# Despliegue en Raspberry Pi 3B+

Guía paso a paso para instalar y dejar corriendo **inventory-sync** (backend + frontend + lector USB) en una Raspberry Pi 3B+ con Raspberry Pi OS (Bullseye/Bookworm).

---

## 1. Preparativos

1. Actualiza la Pi:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
2. Instala dependencias base:
   ```bash
   sudo apt install -y git curl build-essential python3
   ```
3. Comprueba que tienes conexión a la red local y que la Pi recibe una IP fija (o reserva una en tu router).

---

## 2. Node.js 20 con nvm (recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install v20.19.5
nvm use v20.19.5
```

Valida con `node -v` y `npm -v`. Siempre usa esta versión para reinstalar módulos nativos (`better-sqlite3`).

---

## 3. Clonar el proyecto

```bash
git clone <REPO_URL> inventory-sync
cd inventory-sync
npm install              # backend
cd frontend && npm install
cd ..
```

> Si copiaste la carpeta desde Windows, elimina `node_modules` y reinstala en la Pi para recompilar dependencias nativas.

---

## 4. Configurar `sync.config.js`

Edita `sync.config.js` con tu backend real:

```javascript
export default {
  apiBase: 'http://IP_DEL_BACKEND:3000/api/inventario',
  deviceId: 'pi-almacen-01',
  jwt: null,
  codeLength: 12,
  syncIntervalMs: 60_000,
  catalogEndpoint: '/products',
  catalogRefreshMs: 10 * 60_000,
  dbFile: './inventory-sync.db'
};
```

---

## 5. Lector USB (HID)

1. Conecta el lector y localiza su `event` persistente:
   ```bash
   ls -l /dev/input/by-id/
   ```
   Ejemplo: `usb-Linux_3.0.8-svn379_with_dwc2-gadget_HID_Gadget-event-kbd`

2. **Permisos temporales (para probar):**
   ```bash
   sudo setfacl -m u:$USER:rw /dev/input/by-id/usb-...-event-kbd
   ```
3. **Permisos persistentes:**
   ```bash
   echo 'KERNEL=="event*", SUBSYSTEM=="input", GROUP="input", MODE="0660"' | sudo tee /etc/udev/rules.d/99-barcode.rules
   sudo usermod -a -G input $USER
   sudo udevadm control --reload && sudo udevadm trigger
   ```
   Cierra sesión o reinicia para aplicar el grupo `input`.

> Si quieres verificar el dispositivo, puedes usar `sudo evtest /dev/input/by-id/...`.

---

## 6. Script de arranque

Utiliza `start-inventory-service.sh` (ya incluido); asegúrate de que tenga:

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[inventory-sync]"

log() { printf '%s %s\n' "$LOG_PREFIX" "$*"; }

if [ -z "${USB_SCANNER_DEVICE:-}" ] || [ ! -e "$USB_SCANNER_DEVICE" ]; then
  log "Configura USB_SCANNER_DEVICE con /dev/input/by-id/... válido."
  exit 1
fi

if command -v nvm >/dev/null 2>&1; then
  source "$HOME/.nvm/nvm.sh"
fi

NODE_BIN=${NODE_BIN:-$(command -v node)}
if [ -z "$NODE_BIN" ]; then
  log "Node no encontrado. Exporta NODE_BIN o instala Node 20."
  exit 1
fi

cd "$PROJECT_DIR"
log "Iniciando servidor (Node: $NODE_BIN, USB: $USB_SCANNER_DEVICE)"

cleanup() {
  local status=$?
  if [ -n "${SERVER_PID:-}" ]; then
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

Hazlo ejecutable: `chmod +x start-inventory-service.sh`.

---

## 7. Servicio systemd

Archivo `/etc/systemd/system/inventory-sync.service`:

```ini
[Unit]
Description=Inventory Sync Server with USB barcode listener
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi                  # actualiza si usas otro usuario
Group=pi
WorkingDirectory=/home/pi/inventory-sync
Environment=USB_SCANNER_DEVICE=/dev/input/by-id/usb-...-event-kbd
Environment=NODE_BIN=/home/pi/.nvm/versions/node/v20.19.5/bin/node
Environment=NODE_ENV=production
ExecStart=/usr/bin/env USB_SCANNER_DEVICE=${USB_SCANNER_DEVICE} NODE_BIN=${NODE_BIN} /home/pi/inventory-sync/start-inventory-service.sh
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Luego:

```bash
sudo systemctl daemon-reload
sudo systemctl enable inventory-sync.service
sudo systemctl start inventory-sync.service
sudo journalctl -u inventory-sync.service -f   # monitoreo
```

---

## 8. Firewall y red

Si usas `ufw`, permite los puertos usados:

```bash
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 3001/tcp     # API/backend
sudo ufw allow 5173/tcp     # Frontend Vite (desarrollo)
sudo ufw enable
```

En el backend central, habilita el origen de la Pi (IP o red local) para los endpoints `/api/inventario/...`.

---

## 9. Frontend

En otra terminal:

```bash
cd ~/inventory-sync/frontend
npm run dev -- --host 0.0.0.0
```

Accede desde la Pi (o navega desde otra máquina) a `http://IP_PI:5173`.

> Para producción puedes generar `npm run build` y servir el resultado con `npm run preview -- --host 0.0.0.0` o detrás de nginx.

---

## 10. Variables clave

- `USB_SCANNER_DEVICE`: ruta `/dev/input/by-id/...` del lector.
- `NODE_BIN`: binario de Node 20 (especialmente si usas nvm).
- `NODE_ENV`: `production` recomendado.
- `apiBase` en `sync.config.js`: apunta al backend remoto.

---

## 11. Supervisión y mantenimiento

- Logs locales: `synced.log`, `rejected.log`, `inventory-sync.db`.
- Reintentos: el servicio reintenta cada `syncIntervalMs` y también reintenta inmediatamente cuando vuelve la red.
- Para reconstruir dependencias nativas tras actualizar Node:
  ```bash
  npm rebuild better-sqlite3 --build-from-source
  ```
- Respaldos: copia periódica de `inventory-sync.db` y `sync.config.js`.

---

## 12. Checklist final

1. `sudo systemctl status inventory-sync.service` → `active (running)`.
2. `journalctl -u inventory-sync.service -f` muestra lecturas y sincronizaciones.
3. `http://IP_PI:5173` muestra el dashboard y refleja los escaneos en tiempo real.

Con esto la Raspberry Pi 3B+ queda replicando el entorno que ya tienes en Parrot OS, incluyendo lector USB, sincronización offline, precios variables y carga de imágenes.
