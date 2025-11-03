@echo off
title Sistema de Inventario - Servidor
color 0A
echo.
echo ============================================================
echo      SISTEMA DE INVENTARIO - SERVIDOR CON ESCANER
echo ============================================================
echo.
echo  Este terminal capturara el escaner USB automaticamente
echo  NO cierres esta ventana mientras uses el sistema
echo.
echo  Frontend: http://localhost:5173 o http://localhost:5174
echo.
echo ============================================================
echo.

cd /d "%~dp0"

REM Verificar que Node.js esta instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js no esta instalado
    pause
    exit /b 1
)

REM Iniciar el servidor
echo Iniciando servidor...
echo.
node server.js

echo.
echo El servidor se ha detenido
pause
