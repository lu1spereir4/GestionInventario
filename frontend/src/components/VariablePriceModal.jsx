import { useState, useEffect, useRef } from "react";
import "./VariablePriceModal.css";

function VariablePriceModal({ product, onSubmit, onCancel }) {
  const [price, setPrice] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();

    const priceInt = parseInt(price, 10);
    if (Number.isNaN(priceInt) || priceInt <= 0) {
      alert("Por favor ingresa un precio válido mayor a 0");
      return;
    }

    const priceCents = priceInt * 1000;
    onSubmit(priceCents);
    setPrice("");
  };

  const parsedPrice = parseInt(price, 10);
  const isPriceValid = !Number.isNaN(parsedPrice) && parsedPrice > 0;

  const handleQuickPrice = (amount) => {
    setPrice(amount.toString());
  };

  const productName = product.productName || product.barcode;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>💵 Ingresa el Precio</h2>
          <button className="modal-close" onClick={onCancel}>
            ✖
          </button>
        </div>

        <div className="modal-body">
          <div className="product-info">
            {product.imageUrl ? (
              <img
                className="product-thumb"
                src={product.imageUrl}
                alt={productName}
                loading="lazy"
              />
            ) : (
              <div className="product-thumb placeholder">🛒</div>
            )}
            <div>
              <p className="product-name">{productName}</p>
              <p className="product-barcode">Código: {product.barcode}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="price-input-group">
              <span className="currency-symbol">$</span>
              <input
                ref={inputRef}
                type="number"
                step="1"
                min="1"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0"
                className="price-input"
                autoFocus
              />
            </div>

            <div className="quick-prices">
              <p className="quick-prices-label">Precios rápidos:</p>
              <div className="quick-prices-grid">
                {[500, 1000, 1500, 2000, 2500, 3000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="quick-price-btn"
                    onClick={() => handleQuickPrice(amount)}
                  >
                    {`$${amount.toLocaleString("es-CL")}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={!isPriceValid}>
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
