@echo off
echo Instalando Sistema de Inventario...
echo.

REM Verificar Node.js
echo Verificando Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js no esta instalado. Por favor instala Node.js 18+ primero.
    pause
    exit /b 1
)

node -v
echo OK: Node.js encontrado
echo.

REM Instalar dependencias del backend
echo Instalando dependencias del backend...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo la instalacion del backend
    pause
    exit /b 1
)
echo OK: Backend listo
echo.

REM Instalar dependencias del frontend
echo Instalando dependencias del frontend...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo la instalacion del frontend
    cd ..
    pause
    exit /b 1
)
cd ..
echo OK: Frontend listo
echo.

REM Crear archivos de log
echo Creando archivos de log...
type nul > synced.log
type nul > rejected.log
echo OK: Archivos creados
echo.

REM Resumen
echo.
echo ========================================================
echo   Instalacion completada exitosamente
echo ========================================================
echo.
echo Proximos pasos:
echo.
echo 1. Configura tu backend en sync.config.js
echo 2. Ejecuta: npm run dev
echo 3. Abre: http://localhost:5173
echo.
echo Para mas informacion, lee el README.md
echo.
pause
