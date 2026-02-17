import { useState, useEffect, useRef } from 'react';
import './ManualScanner.css';

function ManualScanner({ products = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [lastScan, setLastScan] = useState('');
  const [status, setStatus] = useState('ready'); // 'ready', 'sending'
  const inputRef = useRef(null);
  const [showResults, setShowResults] = useState(false);

  // Auto-focus en el input cuando se monta el componente
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filtrar productos según búsqueda
  const filteredProducts = searchTerm.trim().length > 0
    ? products.filter(product => {
        const search = searchTerm.toLowerCase();
        const name = (product.name || '').toLowerCase();
        const barcode = (product.barcode || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        return name.includes(search) || barcode.includes(search) || category.includes(search);
      }).slice(0, 8) // Limitar a 8 resultados
    : [];

  const sendBarcode = async (code) => {
    if (!code.trim()) return;

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
      
      // Resetear lastScan después de 2 segundos (previene duplicados accidentales inmediatos)
      setTimeout(() => {
        setLastScan('');
      }, 2000);
      
      // Re-enfocar el input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error:', error);
      setStatus('error');
      setTimeout(() => {
        setStatus('ready');
        setLastScan('');
        inputRef.current?.focus();
      }, 2000);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowResults(value.trim().length > 0);
  };

  const handleProductClick = (product) => {
    sendBarcode(product.barcode);
    setSearchTerm('');
    setShowResults(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Si hay exactamente un resultado, escanearlo
    if (filteredProducts.length === 1) {
      handleProductClick(filteredProducts[0]);
    }
    // Si el término de búsqueda parece un código de barras (solo números/letras), escanearlo directamente
    else if (searchTerm.trim().length >= 6) {
      sendBarcode(searchTerm.trim());
      setSearchTerm('');
      setShowResults(false);
    }
  };

  return (
    <div className="manual-scanner">
      <div className="scanner-status">
        <span className="status-icon">{status === 'sending' ? '📤' : '✅'}</span>
        <span className="status-text">
          {status === 'sending' ? 'Enviando...' : 'Buscar o escanear producto'}
        </span>
        {lastScan && (
          <span className="last-scan">Último: {lastScan}</span>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="scanner-form">
        <div className="search-container">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="🔍 Buscar producto o escanear código..."
            className="scanner-input"
            autoFocus
            autoComplete="off"
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearchTerm('');
                setShowResults(false);
                inputRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
        </div>
        
        {showResults && filteredProducts.length > 0 && (
          <div className="products-dropdown">
            {filteredProducts.map((product) => (
              <button
                key={product.barcode}
                type="button"
                className="product-item"
                onClick={() => handleProductClick(product)}
              >
                <div className="product-image">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} loading="lazy" />
                  ) : (
                    <span className="product-placeholder">📦</span>
                  )}
                </div>
                <div className="product-info">
                  <div className="product-name">{product.name || product.barcode}</div>
                  <div className="product-details">
                    <span className="product-barcode">{product.barcode}</span>
                    {product.category && (
                      <span className="product-category">{product.category}</span>
                    )}
                  </div>
                </div>
                {product.defaultPriceCents > 0 && (
                  <div className="product-price">
                    ${Math.round(product.defaultPriceCents).toLocaleString('es-CL')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
        
        {showResults && filteredProducts.length === 0 && (
          <div className="no-results">
            <span>No se encontraron productos</span>
            <small>Presiona Enter para escanear como código directo</small>
          </div>
        )}
      </form>
    </div>
  );
}

export default ManualScanner;
