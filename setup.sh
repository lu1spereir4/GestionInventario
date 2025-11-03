#!/bin/bash

echo "🚀 Instalando Sistema de Inventario..."
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar Node.js
echo -e "${BLUE}Verificando Node.js...${NC}"
if ! command -v node &> /dev/null
then
    echo "❌ Node.js no está instalado. Por favor instala Node.js 18+ primero."
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js $NODE_VERSION encontrado${NC}"
echo ""

# Instalar dependencias del backend
echo -e "${BLUE}Instalando dependencias del backend...${NC}"
npm install
echo -e "${GREEN}✓ Backend listo${NC}"
echo ""

# Instalar dependencias del frontend
echo -e "${BLUE}Instalando dependencias del frontend...${NC}"
cd frontend
npm install
cd ..
echo -e "${GREEN}✓ Frontend listo${NC}"
echo ""

# Crear directorios necesarios
echo -e "${BLUE}Creando estructura de directorios...${NC}"
touch synced.log
touch rejected.log
echo -e "${GREEN}✓ Directorios creados${NC}"
echo ""

# Resumen
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ Instalación completada exitosamente             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📝 Próximos pasos:"
echo ""
echo "1. Configura tu backend en sync.config.js"
echo "2. Ejecuta: npm run dev"
echo "3. Abre: http://localhost:5173"
echo ""
echo "📚 Para más información, lee el README.md"
echo ""
