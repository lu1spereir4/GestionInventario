import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import SalesList from './components/SalesList';
import SummaryCard from './components/SummaryCard';
import VariablePriceModal from './components/VariablePriceModal';
import ConnectionStatus from './components/ConnectionStatus';
import ScannerToggle from './components/ScannerToggle';

const SOCKET_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001' 
  : `http://${window.location.hostname}:3001`;

function App() {
  const [sales, setSales] = useState([]);
  const [connected, setConnected] = useState(false);
  const [pendingVariablePrice, setPendingVariablePrice] = useState(null);
  const socketRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // Inicializar audio para feedback
    audioRef.current = new Audio();
    
    // Conectar al WebSocket
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Conectado al servidor');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Desconectado del servidor');
      setConnected(false);
    });

    socket.on('initial-data', (data) => {
      console.log('📦 Datos iniciales recibidos:', data);
      if (data.sales) {
        setSales(data.sales);
      }
      if (data.pendingVariablePrice) {
        setPendingVariablePrice(data.pendingVariablePrice);
      }
    });

    socket.on('scan-received', (scan) => {
      console.log('📷 Scan recibido:', scan);
      playSound('scan');
    });

    socket.on('sale-completed', (sale) => {
      console.log('✅ Venta completada:', sale);
      setSales(prev => [sale, ...prev]);
      playSound('success');
    });

    socket.on('variable-price-required', (scan) => {
      console.log('⚠️ Precio variable requerido:', scan);
      setPendingVariablePrice(scan);
      playSound('alert');
    });

    socket.on('sale-rejected', (rejection) => {
      console.error('❌ Venta rechazada:', rejection);
      playSound('error');
      alert(`Venta rechazada: ${rejection.reason}`);
    });

    socket.on('sync-error', (error) => {
      console.error('❌ Error de sincronización:', error);
    });

    return () => {
      socket.close();
    };
  }, []);

  const playSound = (type) => {
    // Frecuencias para diferentes tipos de eventos
    const frequencies = {
      scan: 800,
      success: 1000,
      alert: 600,
      error: 400
    };

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequencies[type] || 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const handleVariablePriceSubmit = async (priceCents) => {
    if (!pendingVariablePrice) return;

    try {
      const response = await fetch('/api/set-variable-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanId: pendingVariablePrice.id,
          priceCents
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al enviar precio');
      }

      setPendingVariablePrice(null);
      playSound('success');
    } catch (error) {
      console.error('Error enviando precio:', error);
      alert(`Error: ${error.message}`);
      playSound('error');
    }
  };

  const handleVariablePriceCancel = () => {
    setPendingVariablePrice(null);
  };

  const totalItems = sales.reduce((sum, sale) => sum + (sale.quantity || 1), 0);
  const totalCents = sales.reduce((sum, sale) => sum + (sale.priceCents || 0), 0);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🛒 Sistema de Inventario</h1>
          <ConnectionStatus connected={connected} />
        </div>
      </header>

      <main className="app-main">
        <div className="summary-section">
          <SummaryCard
            title="Total Productos"
            value={totalItems}
            icon="📦"
          />
          <SummaryCard
            title="Total Ventas"
            value={`$${(totalCents / 100).toFixed(2)}`}
            icon="💰"
          />
        </div>

        <ScannerToggle />

        <div className="sales-section">
          <h2>Ventas del Día</h2>
          <SalesList sales={sales} />
        </div>
      </main>

      {pendingVariablePrice && (
        <VariablePriceModal
          product={pendingVariablePrice}
          onSubmit={handleVariablePriceSubmit}
          onCancel={handleVariablePriceCancel}
        />
      )}
    </div>
  );
}

export default App;
