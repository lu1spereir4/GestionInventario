# USB Scanner Guide (Linux/Raspberry Pi)

This project ships with two complementary ways to read barcodes:

1. **Direct USB listener** reading `/dev/input/eventX` (recommended).
2. **Fallback stdin mode** for development environments without root access.

The instructions below show how to run the USB listener in the background so the terminal can remain closed.

---

## 1. Identify the scanner device

```bash
ls -l /dev/input/by-id/
# or
./detect-scanner.sh
```

Scan a barcode while running:

```bash
sudo cat /dev/input/event6
```

If you see random characters the device is correct. Replace `event6` with the path that matches your scanner.

---

## 2. Test the USB listener

```bash
cd ~/inventory-sync
sudo env "PATH=$PATH" node testUSBListener.js /dev/input/event6
```

Scan a barcode. You should see the decoded value in the terminal. Press `Ctrl+C` to stop.

---

## 3. Run the server manually with the USB listener

```bash
cd ~/inventory-sync
sudo env "PATH=$PATH" USB_SCANNER_DEVICE=/dev/input/event6 node server.js
```

In another terminal start the frontend:

```bash
cd ~/inventory-sync/frontend
npm run dev -- --host 0.0.0.0
```

Open `http://<ip>:5173` and scan a product. The dashboard should update instantly.

---

## 4. Background service (recommended for production)

### 4.1 Script

The repository includes `start-inventory-service.sh`. It loads `nvm` when present and validates the required environment variables.

```bash
chmod +x ~/inventory-sync/start-inventory-service.sh
```

### 4.2 systemd unit

Copy the provided template and adjust the `User`, `WorkingDirectory`, and `USB_SCANNER_DEVICE` values if necessary.

```bash
sudo cp ~/inventory-sync/inventory-sync.service /etc/systemd/system/
sudo nano /etc/systemd/system/inventory-sync.service
```

Example content:

```ini
[Unit]
Description=Inventory Sync Server with USB Scanner
After=network.target

[Service]
Type=simple
User=lu1s
Group=lu1s
WorkingDirectory=/home/lu1s/inventory-sync
Environment=USB_SCANNER_DEVICE=/dev/input/event6
Environment=NODE_ENV=production
ExecStart=/home/lu1s/inventory-sync/start-inventory-service.sh
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable inventory-sync.service
sudo systemctl start inventory-sync.service
sudo systemctl status inventory-sync.service
```

Follow the logs:

```bash
sudo journalctl -u inventory-sync.service -f
```

---

## 5. Permissions without sudo

Grant your user access to the input device so systemd can run the service without root:

```bash
sudo usermod -a -G input lu1s
sudo udevadm trigger
```

Optional ACL (when the device path changes often):

```bash
sudo setfacl -m u:lu1s:rw /dev/input/event6
```

Log out and log in to apply the new group membership.

---

## 6. Troubleshooting

- **No codes detected:** verify the service uses the correct `USB_SCANNER_DEVICE`.
- **Permission denied:** run the service with sudo or adjust device permissions.
- **Frontend shows “Disconnected”:** ensure the backend is running (`systemctl status`) and port `3001` is accessible.
- **Wrong characters logged:** scanners that append `\r` instead of `\n` are handled automatically; if you see partial codes, make sure the device mapping is correct.

---

With this setup the USB scanner works even when the terminal is closed. Run the service once and keep the frontend in kiosk mode for the operator. Need to switch devices? Update the environment variable in the unit file and restart the service.*** End Patch
