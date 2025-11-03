#!/bin/bash

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  Sistema de Inventario con USB Directo   ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

# Verificar permisos root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Este script necesita permisos root para acceder al USB"
    echo "💡 Ejecuta con: sudo ./start-with-usb.sh"
    echo ""
    exit 1
fi

# Detectar dispositivos de entrada
echo "🔍 Buscando escáner USB..."
echo ""

DEVICES=$(ls /dev/input/event* 2>/dev/null)

if [ -z "$DEVICES" ]; then
    echo "❌ No se encontraron dispositivos de entrada"
    exit 1
fi

echo "Dispositivos disponibles:"
for dev in $DEVICES; do
    echo "  - $dev"
done

echo ""
echo "🎯 Selecciona el dispositivo del escáner"
echo "   (normalmente event0, event1, etc.)"
echo ""
read -p "Dispositivo [/dev/input/event0]: " SELECTED_DEVICE

# Usar valor por defecto si no se ingresa nada
SELECTED_DEVICE=${SELECTED_DEVICE:-/dev/input/event0}

if [ ! -e "$SELECTED_DEVICE" ]; then
    echo "❌ El dispositivo $SELECTED_DEVICE no existe"
    exit 1
fi

echo ""
echo "✅ Usando dispositivo: $SELECTED_DEVICE"
echo ""
echo "🚀 Iniciando servidor..."
echo ""

# Iniciar el servidor con la variable de entorno
USB_SCANNER_DEVICE=$SELECTED_DEVICE node server.js
