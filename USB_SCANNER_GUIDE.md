# 🔧 SOLUCIÓN: Escáner USB en Linux

## El Problema
El escáner USB escribe como teclado, pero Node.js no captura los datos si el terminal no tiene foco.

## La Solución
Leer directamente del dispositivo USB (`/dev/input/eventX`)

---

## 🎯 Opción 1: Modo Automático (RECOMENDADO)

### Paso 1: Dar permisos

```bash
cd ~/inventory-sync
chmod +x start-with-usb.sh detect-scanner.sh
```

### Paso 2: Ejecutar con sudo

```bash
sudo ./start-with-usb.sh
```

Te preguntará qué dispositivo usar (normalmente `/dev/input/event0`)

### Paso 3: Frontend

En otro terminal:
```bash
cd ~/inventory-sync
npm run frontend
```

¡Listo! El escáner funcionará automáticamente en segundo plano.

---

## 🔍 Opción 2: Probar dispositivos manualmente

### 1. Detectar el dispositivo correcto

```bash
./detect-scanner.sh
```

o manualmente:

```bash
sudo cat /dev/input/event0
```

Escanea un código. Si ves caracteres raros aparecer, ese es el dispositivo correcto.
Prueba event0, event1, event2, etc. hasta encontrar el correcto.

### 2. Probar el listener

```bash
sudo node testUSBListener.js /dev/input/event0
```

Escanea un código y verás si lo captura.

### 3. Iniciar el servidor con USB

```bash
# Reemplaza event0 con tu dispositivo
USB_SCANNER_DEVICE=/dev/input/event0 sudo node server.js
```

---

## 🚀 Opción 3: Modo simple (sin USB directo)

Si no quieres usar sudo, usa el método tradicional:

**Terminal 1:**
```bash
./run-server-tty.sh
```

**Mantén este terminal en FOCO (clic en la ventana)**

**Terminal 2:**
```bash
npm run frontend
```

El escáner escribirá en el terminal con foco.

---

## ⚙️ Configurar para iniciar automáticamente (Producción)

### 1. Crear servicio systemd

```bash
sudo nano /etc/systemd/system/inventory-usb.service
```

Contenido:

```ini
[Unit]
Description=Sistema de Inventario con USB Scanner
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/lu1s/inventory-sync
Environment="USB_SCANNER_DEVICE=/dev/input/event0"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2. Habilitar e iniciar

```bash
sudo systemctl enable inventory-usb
sudo systemctl start inventory-usb
sudo systemctl status inventory-usb
```

### 3. Ver logs

```bash
sudo journalctl -u inventory-usb -f
```

---

## ✅ Verificar que funciona

1. Servidor iniciado (cualquier método)
2. Frontend iniciado: `npm run frontend`
3. Abre navegador: `http://localhost:5173`
4. Escanea un código
5. Deberías ver en el terminal del servidor:
   ```
   📦 Código escaneado: XXXXXXXX
   ```
6. Y en el frontend debe aparecer el producto

---

## 🔑 Permisos (sin sudo)

Si no quieres usar sudo, agrega tu usuario al grupo input:

```bash
sudo usermod -a -G input $USER
sudo chmod 666 /dev/input/event*
```

Cierra sesión y vuelve a entrar.

Luego puedes ejecutar sin sudo:

```bash
USB_SCANNER_DEVICE=/dev/input/event0 node server.js
```

---

## 📝 Resumen de comandos

```bash
# Detectar dispositivo
./detect-scanner.sh

# Método 1: Automático con USB directo (MEJOR)
sudo ./start-with-usb.sh

# Método 2: Probar listener
sudo node testUSBListener.js /dev/input/event0

# Método 3: Servidor con USB
USB_SCANNER_DEVICE=/dev/input/event0 sudo node server.js

# Método 4: Tradicional (terminal con foco)
./run-server-tty.sh

# Frontend (siempre igual)
npm run frontend
```

---

¿Cuál método prefieres usar?
