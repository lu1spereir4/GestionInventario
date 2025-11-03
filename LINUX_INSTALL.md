# 🐧 Instalación y Configuración en Linux/Raspberry Pi

## 📦 Requisitos

- Raspberry Pi OS (Raspbian) o cualquier distribución Linux
- Node.js 18+ instalado
- Lector de códigos de barras USB
- Conexión a red local

## 🚀 Instalación Rápida

### 1. Instalar Node.js (si no está instalado)

```bash
# Verificar si está instalado
node -v

# Si no está instalado, en Raspberry Pi:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node -v
npm -v
```

### 2. Clonar o copiar el proyecto

```bash
cd ~
# Si tienes git:
git clone <tu-repositorio> GestionInventario

# O copia los archivos manualmente
cd GestionInventario
```

### 3. Instalar dependencias

```bash
# Instalar todo
npm run install-all

# O manualmente:
npm install
cd frontend
npm install
cd ..
```

### 4. Configurar el sistema

Edita `sync.config.js`:

```bash
nano sync.config.js
```

Configura tu backend:

```javascript
export default {
  apiBase: 'http://192.168.1.47:3000/api/inventario', // IP de tu backend
  deviceId: 'pi-almacen-01',
  jwt: null,
  codeLength: 12,
  syncIntervalMs: 60_000,
  dbFile: './inventory-sync.db'
};
```

### 5. Hacer ejecutables los scripts

```bash
chmod +x run-server-tty.sh
chmod +x setup.sh
```

## 🎯 Ejecutar el Sistema

### Desarrollo (2 terminales)

**Terminal 1 - Servidor:**
```bash
node server.js
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Accede desde cualquier dispositivo en la red:
- `http://<IP_RASPBERRY>:5173`

### Producción (Systemd Services)

#### 1. Crear servicio del servidor

```bash
sudo nano /etc/systemd/system/inventory-server.service
```

Contenido:

```ini
[Unit]
Description=Sistema de Inventario - Servidor
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/GestionInventario
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardInput=tty
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes

[Install]
WantedBy=multi-user.target
```

#### 2. Crear servicio del frontend

```bash
sudo nano /etc/systemd/system/inventory-frontend.service
```

Contenido:

```ini
[Unit]
Description=Sistema de Inventario - Frontend
After=network.target inventory-server.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/GestionInventario/frontend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run dev -- --host 0.0.0.0
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 3. Habilitar e iniciar servicios

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar servicios (inicio automático)
sudo systemctl enable inventory-server
sudo systemctl enable inventory-frontend

# Iniciar servicios
sudo systemctl start inventory-server
sudo systemctl start inventory-frontend

# Ver estado
sudo systemctl status inventory-server
sudo systemctl status inventory-frontend

# Ver logs en tiempo real
sudo journalctl -u inventory-server -f
sudo journalctl -u inventory-frontend -f
```

## 🖥️ Configurar Pantalla (Kiosk Mode)

### Chromium en modo pantalla completa

Editar autostart:

```bash
sudo nano /etc/xdg/lxsession/LXDE-pi/autostart
```

Agregar:

```bash
@xset s off
@xset -dpms
@xset s noblank
@chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-restore-session-state http://localhost:5173
```

### Deshabilitar salvapantallas

```bash
sudo raspi-config
# Display Options > Screen Blanking > No
```

## 🔍 Verificar el Escáner USB

### 1. Verificar que el escáner está conectado

```bash
lsusb
# Deberías ver tu dispositivo USB listado
```

### 2. Verificar dispositivos de entrada

```bash
ls -l /dev/input/
cat /proc/bus/input/devices
```

### 3. Probar el escáner directamente

```bash
# El escáner debería aparecer como un teclado
sudo cat /dev/input/event0
# Escanea un código y verás caracteres aparecer
```

### 4. Permisos (si es necesario)

```bash
# Agregar usuario al grupo input
sudo usermod -a -G input pi

# Reiniciar sesión
logout
```

## 🎯 Probar el Sistema

### 1. Verificar servidor

```bash
curl http://localhost:3001/api/sales/today
```

Deberías recibir un JSON con las ventas.

### 2. Verificar frontend

Abre el navegador en:
- Local: `http://localhost:5173`
- Remoto: `http://<IP_RASPBERRY>:5173`

### 3. Probar escáner

1. Asegúrate de que el servidor está corriendo en un terminal directo (no con npm)
2. El terminal debe estar en foco (ventana activa)
3. Escanea un código
4. Deberías ver en el terminal: `📷 Código procesado: XXXXX`
5. El producto debe aparecer en el frontend

## 📊 Comandos Útiles

```bash
# Ver base de datos
npm run check-db

# Limpiar base de datos
rm -f inventory-sync.db*

# Ver logs del sistema
tail -f synced.log
tail -f rejected.log

# Reiniciar servicios
sudo systemctl restart inventory-server
sudo systemctl restart inventory-frontend

# Detener servicios
sudo systemctl stop inventory-server
sudo systemctl stop inventory-frontend

# Ver uso de recursos
htop
```

## 🔧 Solución de Problemas

### El escáner no funciona

1. **Verificar que el servidor está en modo TTY:**
   ```bash
   # Debe mostrar "✅ Modo TTY"
   # Si muestra "Modo no-TTY", ejecuta directamente:
   node server.js
   ```

2. **Verificar permisos:**
   ```bash
   sudo usermod -a -G input $USER
   logout
   ```

3. **Probar escáner manualmente:**
   ```bash
   # En el terminal del servidor, escribe un código y presiona Enter
   # Debería funcionar
   ```

### Frontend no accesible desde otros dispositivos

1. **Verificar firewall:**
   ```bash
   sudo ufw allow 5173
   sudo ufw allow 3001
   ```

2. **Verificar que Vite escucha en 0.0.0.0:**
   ```bash
   # En frontend/package.json debe ser:
   "dev": "vite --host 0.0.0.0"
   ```

### Base de datos bloqueada

```bash
# Detener servicios
sudo systemctl stop inventory-server

# Eliminar locks
rm -f inventory-sync.db-shm inventory-sync.db-wal

# Reiniciar
sudo systemctl start inventory-server
```

## 🌐 Acceso Remoto

Para acceder desde otros dispositivos en la red:

1. **Encontrar la IP de la Raspberry:**
   ```bash
   hostname -I
   # Ejemplo: 192.168.1.100
   ```

2. **Acceder desde otro dispositivo:**
   - Frontend: `http://192.168.1.100:5173`
   - API: `http://192.168.1.100:3001`

## 🔒 Seguridad

### 1. Cambiar contraseña por defecto

```bash
passwd
```

### 2. Configurar firewall

```bash
sudo apt install ufw
sudo ufw allow 22      # SSH
sudo ufw allow 5173    # Frontend
sudo ufw allow 3001    # API
sudo ufw enable
```

### 3. Actualizar sistema

```bash
sudo apt update
sudo apt upgrade -y
```

## 📝 Mantenimiento

### Actualizar el código

```bash
cd ~/GestionInventario
git pull
npm install
cd frontend
npm install
cd ..

# Reiniciar servicios
sudo systemctl restart inventory-server
sudo systemctl restart inventory-frontend
```

### Backup de base de datos

```bash
# Crear backup
cp inventory-sync.db inventory-sync.db.backup

# Restaurar backup
sudo systemctl stop inventory-server
cp inventory-sync.db.backup inventory-sync.db
sudo systemctl start inventory-server
```

## ✅ Checklist de Instalación

- [ ] Node.js instalado y funcionando
- [ ] Proyecto copiado a `/home/pi/GestionInventario`
- [ ] Dependencias instaladas (`npm run install-all`)
- [ ] `sync.config.js` configurado con IP del backend
- [ ] Scripts tienen permisos de ejecución
- [ ] Escáner USB conectado y detectado (`lsusb`)
- [ ] Servicios systemd creados y habilitados
- [ ] Chromium configurado en modo kiosk
- [ ] Firewall configurado (si es necesario)
- [ ] Sistema probado con escaneo manual

¡Listo para producción! 🚀
