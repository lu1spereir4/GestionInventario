@echo off
title Sistema de Inventario - Launcher

echo.
echo ============================================================
echo      INICIANDO SISTEMA DE INVENTARIO COMPLETO
echo ============================================================
echo.

cd /d "%~dp0"

REM Iniciar el servidor en una nueva ventana
echo [1/3] Iniciando servidor con escaner...
start "Inventario - Servidor" /D "%~dp0" cmd /k "run-server-tty.bat"

REM Esperar 3 segundos
timeout /t 3 /nobreak >nul

REM Iniciar el frontend en otra ventana
echo [2/3] Iniciando frontend...
start "Inventario - Frontend" /D "%~dp0\frontend" cmd /k "npm run dev"

REM Esperar 2 segundos
timeout /t 2 /nobreak >nul

REM Abrir el capturador de escáner en el navegador
echo [3/3] Abriendo capturador de escaner...
start "" "%~dp0\scanner-capture.html"

echo.
echo ============================================================
echo   SISTEMA INICIADO
echo ============================================================
echo.
echo   Servidor:     http://localhost:3001
echo   Frontend:     http://localhost:5173
echo   Capturador:   scanner-capture.html (ventana abierta)
echo.
echo   Se abrieron 3 componentes:
echo   1. Servidor (procesa las ventas)
echo   2. Frontend (visualiza las ventas)
echo   3. Capturador (captura el escaner USB)
echo.
echo   IMPORTANTE:
echo   - Deja el CAPTURADOR abierto para que funcione el escaner
echo   - El capturador envia automaticamente los codigos al servidor
echo.
echo ============================================================
echo.

REM Esperar 8 segundos antes de cerrar esta ventana
timeout /t 8

exit
