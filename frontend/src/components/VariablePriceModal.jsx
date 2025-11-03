import { useState, useEffect, useRef } from 'react';
import './VariablePriceModal.css';

function VariablePriceModal({ product, onSubmit, onCancel }) {
  const [price, setPrice] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-focus en el input cuando se abre el modal
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Por favor ingresa un precio válido mayor a 0');
      return;
    }

    const priceCents = Math.round(priceNum * 100);
    onSubmit(priceCents);
    setPrice('');
  };

  const handleQuickPrice = (amount) => {
    setPrice(amount.toString());
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💰 Ingresa el Precio</h2>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="product-info">
            <p className="product-name">{product.productName}</p>
            <p className="product-barcode">Código: {product.barcode}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="price-input-group">
              <span className="currency-symbol">$</span>
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="price-input"
                autoFocus
              />
            </div>

            <div className="quick-prices">
              <p className="quick-prices-label">Precios rápidos:</p>
              <div className="quick-prices-grid">
                {[0.50, 1.00, 2.00, 5.00, 10.00, 20.00].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="quick-price-btn"
                    onClick={() => handleQuickPrice(amount)}
                  >
                    ${amount.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!price || parseFloat(price) <= 0}
              >
                Confirmar Venta
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default VariablePriceModal;
