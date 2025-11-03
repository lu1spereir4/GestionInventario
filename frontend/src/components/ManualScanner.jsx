import { useState, useEffect, useRef } from 'react';
import './ManualScanner.css';

function ManualScanner() {
  const [barcode, setBarcode] = useState('');
  const [lastScan, setLastScan] = useState('');
  const [status, setStatus] = useState('ready'); // 'ready', 'scanning', 'sending'
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);

  // Auto-focus en el input cuando se monta el componente
  useEffect(() => {
    inputRef.current?.focus();
    
    // Mantener el foco siempre en el input
    const handleClickAnywhere = () => {
      inputRef.current?.focus();
    };
    
    document.addEventListener('click', handleClickAnywhere);
    
    return () => {
      document.removeEventListener('click', handleClickAnywhere);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const sendBarcode = async (code) => {
    if (!code.trim() || code === lastScan) return;

    setStatus('sending');
    setLastScan(code);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barcode: code.trim() })
      });

      if (!response.ok) {
        throw new Error('Error al enviar código');
      }

      console.log('✅ Código enviado:', code);
      setStatus('ready');
      
      // Limpiar después de 500ms
      setTimeout(() => {
        setBarcode('');
        inputRef.current?.focus();
      }, 500);
    } catch (error) {
      console.error('Error:', error);
      setStatus('error');
      setTimeout(() => {
        setStatus('ready');
        setBarcode('');
      }, 2000);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setBarcode(value);
    setStatus('scanning');

    // Limpiar timeout previo
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Auto-enviar después de 100ms sin nuevas teclas (el escáner es rápido)
    timeoutRef.current = setTimeout(() => {
      if (value.trim().length > 0) {
        sendBarcode(value);
      }
    }, 150);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (barcode.trim()) {
      sendBarcode(barcode);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'scanning':
        return '📷';
      case 'sending':
        return '📤';
      case 'error':
        return '❌';
      default:
        return '✅';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'scanning':
        return 'Escaneando...';
      case 'sending':
        return 'Enviando...';
      case 'error':
        return 'Error';
      default:
        return 'Listo para escanear';
    }
  };

  return (
    <div className="manual-scanner">
      <div className="scanner-status">
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">{getStatusText()}</span>
        {lastScan && (
          <span className="last-scan">Último: {lastScan}</span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="scanner-form">
        <input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={handleChange}
          placeholder="� Foco aquí para escanear..."
          className="scanner-input"
          autoFocus
          autoComplete="off"
        />
      </form>
    </div>
  );
}

export default ManualScanner;
