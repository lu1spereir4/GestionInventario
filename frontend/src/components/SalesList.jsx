import "./SalesList.css";

function SalesList({ sales, onDeleteSale, deletingSaleIds }) {
  if (!sales.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p>No hay ventas registradas hoy</p>
        <p className="empty-subtitle">Los productos escaneados aparecerán aquí</p>
      </div>
    );
  }

  const isDeleting = (id) => {
    if (!id) return false;
    if (deletingSaleIds instanceof Set) {
      return deletingSaleIds.has(id);
    }
    if (Array.isArray(deletingSaleIds)) {
      return deletingSaleIds.includes(id);
    }
    if (deletingSaleIds && typeof deletingSaleIds.has === "function") {
      try {
        return deletingSaleIds.has(id);
      } catch {
        return false;
      }
    }
    return false;
  };

  return (
    <div className="sales-list">
      {sales.map((sale) => (
        <SaleItem
          key={sale.id}
          sale={sale}
          onDelete={onDeleteSale}
          isDeleting={isDeleting(sale.id)}
        />
      ))}
    </div>
  );
}

function SaleItem({ sale, onDelete, isDeleting }) {
  const formatPrice = (value) => {
    const pesos = Math.max(0, Math.round(value || 0));
    return `$${pesos.toLocaleString("es-CL")}`;
  };

  const formatTime = (isoString) => {
    const utcDate = new Date(isoString);
    const localDate = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
    return localDate.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getCategoryEmoji = (category) => {
    const emojis = {
      bebida_latas: "🥤",
      pasteleria: "🍰",
      selladitos: "🍪",
      cafeteria: "☕",
      pastillas: "💊",
      papas_fritas_cajita: "🍟",
      bebidas_energeticas: "⚡",
      varios: "📦",
    };
    return emojis[category] || "📦";
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
  const canDelete = typeof onDelete === "function";

  const handleDelete = () => {
    if (canDelete) {
      onDelete(sale);
    }
  };

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
      <div className="sale-actions">
        <div className="sale-price">{formatPrice(sale.priceCents)}</div>
        {canDelete && (
          <button
            className="sale-delete-button"
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={`Eliminar ${productLabel}`}
            title="Eliminar venta"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9 10V17M15 10V17M4 6H20M19 6L18.4 19.2C18.3568 20.1998 18.3152 20.6997 18.1099 21.0829C17.9282 21.4206 17.6548 21.6985 17.3194 21.8849C16.941 22.0942 16.4415 22.0942 15.4426 22.0942H8.55739C7.55853 22.0942 7.05911 22.0942 6.68061 21.8849C6.34525 21.6985 6.07175 21.4206 5.89012 21.0829C5.68485 20.6997 5.64322 20.1998 5.60001 19.2L5 6M9 6V4.8C9 4.31998 9 4.07996 9.08798 3.90125C9.16536 3.74014 9.29239 3.61311 9.4535 3.53573C9.63221 3.44775 9.87223 3.44775 10.3523 3.44775H13.6477C14.1278 3.44775 14.3678 3.44775 14.5465 3.53573C14.7076 3.61311 14.8346 3.74014 14.912 3.90125C15 4.07996 15 4.31998 15 4.8V6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default SalesList;
