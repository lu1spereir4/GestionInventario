# 🚀 INICIO RÁPIDO - Sistema de Inventario

## 🐧 Para Linux/Raspberry Pi (PRODUCCIÓN)

El sistema está optimizado para funcionar en Linux/Raspberry Pi con escáner USB.

### Instalación completa:

Ver guía detallada en: **[LINUX_INSTALL.md](LINUX_INSTALL.md)**

### Inicio rápido en Linux:

**Terminal 1 - Servidor:**
```bash
./run-server-tty.sh
# O directamente:
node server.js
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

### Servicio en segundo plano (systemd)

1. Edita las variables necesarias en `inventory-sync.service`.
2. Copia el archivo a `/etc/systemd/system/`:
   ```bash
   sudo cp ~/inventory-sync/inventory-sync.service /etc/systemd/system/
   ```
3. Da permisos de ejecución al script de arranque:
   ```bash
   chmod +x ~/inventory-sync/start-inventory-service.sh
   ```
4. Recarga systemd y habilita el servicio:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable inventory-sync.service
   sudo systemctl start inventory-sync.service
   sudo systemctl status inventory-sync.service
   ```
5. Inicia el frontend en otra terminal:
   ```bash
   cd ~/inventory-sync/frontend
   npm run dev -- --host 0.0.0.0
   ```

**Acceder:**
- Local: `http://localhost:5173`
- Remoto: `http://<IP_RASPBERRY>:5173`

**Escanear:**
- El escáner funcionará automáticamente en el terminal del servidor
- Los códigos se procesan en segundo plano
- Las ventas aparecen en tiempo real en el frontend

---

## 💻 Para Windows (DESARROLLO)

En Windows, el escáner USB puede tener problemas con el stdin. 
Hay dos opciones:

### Opción 1: Usar modo manual en el frontend

1. Inicia el servidor:
   ```bash
   node server.js
   ```

2. Inicia el frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Abre el navegador en: `http://localhost:5173`

4. Haz clic en "⌨️ Modo Manual" en el frontend

5. Escanea los códigos - se capturarán en el campo de entrada

### Opción 2: Inicio Manual

#### Terminal 1 - Servidor:
```bash
# Doble clic en: run-server-tty.bat
# O ejecuta:
node server.js
```

#### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

## 🎯 Cómo usar el escáner

### Escáner USB (Raspberry Pi / Producción)

1. Asegúrate de que el servidor esté corriendo en su propio terminal
2. El escáner funcionará **automáticamente en segundo plano**
3. No necesitas tener el foco en ninguna ventana
4. Los códigos se procesan automáticamente

### Modo Manual (Desarrollo / Sin escáner)

1. Abre el frontend: `http://localhost:5173`
2. Haz clic en "⌨️ Modo Manual"
3. Escribe o escanea códigos en el campo
4. Se envían automáticamente

## ⚙️ Configuración

Edita `sync.config.js`:

```javascript
export default {
  apiBase: 'http://TU_IP:3000/api/inventario',
  deviceId: 'pi-almacen-01',
  codeLength: 12,
  // ...
};
```

## 🐛 Problemas Comunes

### El escáner no funciona

**Causa:** El servidor no está en su propio terminal.

**Solución:** 
- NO uses `npm run dev` (usa dos terminales por separado)
- Usa `start-all.bat` o `run-server-tty.bat`

### Los códigos no aparecen en el frontend

**Verificar:**
1. ¿El servidor está corriendo? (ventana del servidor debe estar abierta)
2. ¿El frontend muestra "Conectado" en verde?
3. ¿El backend responde correctamente?

**Debug:**
```bash
# Ver logs del servidor
npm run check-db
```

## 📊 Verificar Base de Datos

```bash
npm run check-db
```

Esto te mostrará:
- Total de registros
- Scans por estado (pending, synced, rejected)
- Últimos 10 registros
- Scans de hoy

## 🔧 Scripts Disponibles

```bash
npm run server          # Solo servidor
npm run frontend        # Solo frontend
npm run check-db        # Ver estado de la BD
npm run install-all     # Instalar dependencias
```

## 📱 Para Raspberry Pi

1. Copia el proyecto a la Raspberry Pi
2. Ejecuta: `chmod +x run-server-tty.sh`
3. Ejecuta: `./run-server-tty.sh`
4. El escáner funcionará automáticamente

## ✅ Flujo de Trabajo Normal

1. **Iniciar:** Doble clic en `start-all.bat`
2. **Abrir navegador:** `http://localhost:5173`
3. **Escanear:** Los códigos se procesan automáticamente
4. **Ver ventas:** Aparecen en tiempo real en la pantalla
5. **Precio variable:** Se abre modal automáticamente cuando es necesario

¡Listo! 🎉
