import { useState } from 'react';
import './ScanSimulator.css';

function ScanSimulator() {
  const [barcode, setBarcode] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    try {
      const response = await fetch('/api/simulate-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barcode: barcode.trim() })
      });

      if (response.ok) {
        setBarcode('');
        setIsOpen(false);
      } else {
        alert('Error al simular escaneo');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error de conexión');
    }
  };

  const quickScans = [
    { label: 'Coca-Cola', barcode: '7501055300006' },
    { label: 'Galletas', barcode: '7501000000001' },
    { label: 'Papas', barcode: '7501000000002' },
    { label: 'Varios', barcode: 'VA00000000VA' },
  ];

  if (!isOpen) {
    return (
      <button className="sim-toggle-btn" onClick={() => setIsOpen(true)}>
        🧪 Simulador
      </button>
    );
  }

  return (
    <div className="sim-panel">
      <div className="sim-header">
        <h3>🧪 Simulador de Escaneos</h3>
        <button className="sim-close" onClick={() => setIsOpen(false)}>
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="sim-form">
        <input
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Código de barras"
          className="sim-input"
          autoFocus
        />
        <button type="submit" className="sim-btn-primary">
          Escanear
        </button>
      </form>

      <div className="sim-quick">
        <p className="sim-quick-label">Escaneos rápidos:</p>
        {quickScans.map((item) => (
          <button
            key={item.barcode}
            type="button"
            className="sim-quick-btn"
            onClick={() => {
              setBarcode(item.barcode);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ScanSimulator;
