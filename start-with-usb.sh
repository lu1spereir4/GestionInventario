#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==========================================="
echo "  Sistema de Inventario - USB directo"
echo "==========================================="
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "Este script necesita permisos de administrador."
  echo "Ejecuta: sudo env \"PATH=$PATH\" ./start-with-usb.sh"
  exit 1
fi

cd "$PROJECT_DIR"

# Load nvm if available so we can reach the same Node.js version used by the user.
if [ -z "${NVM_DIR:-}" ]; then
  if [ -d "$HOME/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
  fi
fi

if [ -n "${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm use --silent >/dev/null 2>&1 || true
fi

NODE_BIN="${NODE_BIN:-$(command -v node || true)}"

if [ -z "$NODE_BIN" ]; then
  echo "Node.js no está disponible en el PATH."
  echo "Define NODE_BIN o instala Node para el usuario root."
  exit 1
fi

DEVICES=$(ls /dev/input/event* 2>/dev/null || true)

if [ -z "$DEVICES" ]; then
  echo "No se encontraron dispositivos en /dev/input/event*."
  exit 1
fi

echo "Dispositivos detectados:"
echo "$DEVICES" | sed 's/^/  - /'
echo ""

read -r -p "Selecciona el dispositivo [/dev/input/event0]: " SELECTED_DEVICE
SELECTED_DEVICE=${SELECTED_DEVICE:-/dev/input/event0}

if [ ! -e "$SELECTED_DEVICE" ]; then
  echo "El dispositivo $SELECTED_DEVICE no existe."
  exit 1
fi

echo ""
echo "Iniciando servidor con USB_SCANNER_DEVICE=$SELECTED_DEVICE"
echo ""

USB_SCANNER_DEVICE="$SELECTED_DEVICE" exec "$NODE_BIN" server.js
