#!/usr/bin/env bash
#
# Helper used by the systemd unit to start the inventory server in the background.
# The script makes sure Node.js is available (it supports users that manage Node
# with nvm) and verifies that the USB scanner device path is configured.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[inventory-sync]"

log() {
  printf '%s %s\n' "$LOG_PREFIX" "$*"
}

# Load nvm when it is installed. This is required when Node.js was installed
# via nvm instead of the system package manager.
if [ -z "${NVM_DIR:-}" ]; then
  if [ -d "$HOME/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
  fi
fi

if [ -n "${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  # Attempt to use the active LTS version – ignore errors so the script
  # continues even when no matching version is found.
  nvm use --silent >/dev/null 2>&1 || true
fi

NODE_BIN="${NODE_BIN:-$(command -v node || true)}"

if [ -z "$NODE_BIN" ]; then
  log "Node.js no está disponible en el PATH. Ajusta la variable NODE_BIN."
  exit 1
fi

if [ ! -x "$NODE_BIN" ]; then
  log "El binario de Node.js no es ejecutable: $NODE_BIN"
  exit 1
fi

if [ -z "${USB_SCANNER_DEVICE:-}" ]; then
  log "La variable USB_SCANNER_DEVICE no está definida."
  log "Ejemplo: USB_SCANNER_DEVICE=/dev/input/event2"
  exit 1
fi

if [ ! -e "$USB_SCANNER_DEVICE" ]; then
  log "El dispositivo $USB_SCANNER_DEVICE no existe."
  exit 1
fi

export NODE_ENV="${NODE_ENV:-production}"

cd "$PROJECT_DIR"

log "Iniciando servidor (Node: $NODE_BIN, USB: $USB_SCANNER_DEVICE)"

cleanup() {
  local code=$?
  if [ -n "${SERVER_PID:-}" ]; then
    log "Recibida señal, deteniendo servidor (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  exit $code
}

trap cleanup INT TERM

"$NODE_BIN" server.js &
SERVER_PID=$!

wait "$SERVER_PID"

