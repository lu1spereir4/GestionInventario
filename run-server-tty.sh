#!/bin/bash

echo ""
echo "========================================"
echo "  Sistema de Inventario - Servidor"
echo "========================================"
echo ""
echo "  Este terminal capturará el escáner USB"
echo "  Mantén esta ventana abierta"
echo ""

# Ir al directorio del script
cd "$(dirname "$0")"

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado"
    echo "Instala Node.js 18+ primero"
    exit 1
fi

echo "✅ Node.js: $(node -v)"
echo ""

# Verificar que las dependencias están instaladas
if [ ! -d "node_modules" ]; then
    echo "⚠️  Instalando dependencias..."
    npm install
fi

echo "🚀 Iniciando servidor..."
echo ""

# Ejecutar el servidor con stdin habilitado
cleanup() {
    if [ -n "${SERVER_PID:-}" ]; then
        echo ""
        echo "Deteniendo servidor..."
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup INT TERM

node server.js &
SERVER_PID=$!
wait "$SERVER_PID"
