import { useState, useEffect, useRef } from "react";
import "./VariablePriceModel.css";

function VariablePriceModal({ product, onSubmit, onCancel }) {
  const [price, setPrice] = useState("");
  const inputRef = useRef(null);

  const productName = product.productName || product.name || product.barcode;
  const isVariableProduct = [
    (product.pricingMode || "").toLowerCase(),
    (product.category || "").toLowerCase(),
    (productName || "").toLowerCase(),
  ].some((value) => value === "varios" || value === "variable");

  useEffect(() => {
    if (!isVariableProduct && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVariableProduct]);

  useEffect(() => {
    const defaultValue = product.priceCents ?? product.defaultPriceCents ?? 0;
    if (defaultValue > 0) {
      setPrice(String(defaultValue));
    } else {
      setPrice("");
    }
  }, [product]);

  const priceInt = price.length ? parseInt(price, 10) : NaN;
  const isPriceValid = !Number.isNaN(priceInt) && priceInt > 0;

  const submitPrice = () => {
    if (!isPriceValid) {
      alert("Por favor ingresa un precio válido mayor a 0");
      return;
    }

    const priceCents = priceInt;
    onSubmit(priceCents);
    setPrice("");
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    submitPrice();
  };

  const appendDigit = (digit) => {
    setPrice((prev) => {
      const base = prev === "0" ? "" : prev;
      const next = `${base}${digit}`.replace(/^0+/, "");
      return next.slice(0, 6);
    });
  };

  const removeDigit = () => {
    setPrice((prev) => prev.slice(0, -1));
  };

  const clearPrice = () => setPrice("");

  const keypadDigits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  const formattedDisplay = isPriceValid
    ? priceInt.toLocaleString("es-CL")
    : "0";

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
      >
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

          {isVariableProduct ? (
            <>
              <div className="keypad">
                <div className="price-display">${formattedDisplay}</div>
                <div className="keypad-grid">
                  {keypadDigits.map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      className="keypad-button"
                      onClick={() => appendDigit(digit)}
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="keypad-button secondary"
                    onClick={removeDigit}
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    className="keypad-button secondary"
                    onClick={clearPrice}
                  >
                    Borrar
                  </button>
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
                  type="button"
                  className="btn btn-primary"
                  onClick={submitPrice}
                  disabled={!isPriceValid}
                >
                  Enviar
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleFormSubmit}>
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
                />
              </div>

              <div className="quick-prices">
                <p className="quick-prices-label">Precios rápidos:</p>
                <div className="quick-prices-grid">
                  {[1000, 1500, 2000, 2500, 3000, 5000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="quick-price-btn"
                      onClick={() => setPrice(String(amount))}
                    >
                      {`$${amount.toLocaleString("es-CL")}`}
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
                  disabled={!isPriceValid}
                >
                  Confirmar Venta
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default VariablePriceModal;

