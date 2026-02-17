import { useState } from 'react';
import ManualScanner from './ManualScanner';
import './ScannerToggle.css';

function ScannerToggle({ products = [] }) {
  const [showScanner, setShowScanner] = useState(false);

  return (
    <div className="scanner-toggle-container">
      {!showScanner && (
        <button 
          className="toggle-scanner-btn"
          onClick={() => setShowScanner(true)}
        >
          ⌨️ Modo Manual
        </button>
      )}
      
      {showScanner && (
        <div className="scanner-wrapper">
          <div className="scanner-header">
            <h3>Modo Manual de Escaneo</h3>
            <button 
              className="close-scanner-btn"
              onClick={() => setShowScanner(false)}
            >
              ✕
            </button>
          </div>
          <ManualScanner products={products} />
        </div>
      )}
    </div>
  );
}

export default ScannerToggle;
