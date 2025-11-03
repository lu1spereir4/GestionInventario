#!/bin/bash

# Script para detectar el dispositivo del escáner USB
echo "🔍 Buscando escáner USB..."
echo ""

# Listar dispositivos de entrada
echo "Dispositivos de entrada disponibles:"
ls -la /dev/input/by-id/ 2>/dev/null || ls -la /dev/input/

echo ""
echo "Dispositivos event:"
ls -la /dev/input/event* 2>/dev/null

echo ""
echo "---"
echo "Para probar un dispositivo específico, ejecuta:"
echo "  sudo cat /dev/input/event0"
echo "  (cambia event0 por el número correcto)"
echo ""
echo "Luego escanea un código y verás si aparecen datos"
