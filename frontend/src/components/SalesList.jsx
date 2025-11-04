import "./SalesList.css";

function SalesList({ sales }) {
  if (!sales.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📦</div>
        <p>No hay ventas registradas hoy</p>
        <p className="empty-subtitle">Los productos escaneados aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="sales-list">
      {sales.map((sale) => (
        <SaleItem key={sale.id} sale={sale} />
      ))}
    </div>
  );
}

function SaleItem({ sale }) {
  const formatPrice = (value) => {
    const pesos = Math.max(0, Math.round(value || 0));
    return `$${pesos.toLocaleString("es-CL")}`;
  };

  const formatTime = (isoString) => {
    const utcDate = new Date(isoString);
    const localDate = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
    return localDate.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getCategoryEmoji = (category) => {
    const emojis = {
      bebida_latas: "🥤",
      pasteleria: "🧁",
      selladitos: "🥪",
      cafeteria: "☕️",
      pastillas: "💊",
      papas_fritas_cajita: "🍟",
      bebidas_energeticas: "⚡️",
      varios: "🛒",
    };
    return emojis[category] || "🛒";
  };

  const status = sale.status || "pending";
  const statusLabel =
    {
      synced: "Sincronizada",
      pending: "Pendiente",
      rejected: "Rechazada",
    }[status] || "Pendiente";

  const imageUrl = sale.imageUrl || null;
  const productLabel = sale.productName || sale.barcode;

  return (
    <div className="sale-item">
      <div className="sale-image">
        {imageUrl ? (
          <img src={imageUrl} alt={productLabel} loading="lazy" />
        ) : (
          <div className="sale-placeholder">{getCategoryEmoji(sale.category)}</div>
        )}
      </div>
      <div className="sale-details">
        <div className="sale-name">{productLabel}</div>
        <div className="sale-meta">
          <span className="sale-time">{formatTime(sale.scannedAt)}</span>
          <span className="sale-quantity">x{sale.quantity || 1}</span>
          <span className={`sale-status sale-status-${status}`}>{statusLabel}</span>
        </div>
      </div>
      <div className="sale-price">{formatPrice(sale.priceCents)}</div>
    </div>
  );
}

export default SalesList;
