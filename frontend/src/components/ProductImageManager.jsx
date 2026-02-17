import { useMemo, useState } from "react";
import "./ProductImageManager.css";

const normalize = (name = "") => name.trim().toLowerCase();

function ProductImageManager({ products, onImageUploaded }) {
  const [selectedGroup, setSelectedGroup] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);

  const groupedProducts = useMemo(() => {
    const groups = new Map();

    products.forEach((product) => {
      if (!product?.name || !product?.barcode) {
        return;
      }

      const key = normalize(product.name);
      const displayName = product.name.trim();

      if (!groups.has(key)) {
        groups.set(key, { key, displayName, barcodes: [] });
      }

      groups.get(key).barcodes.push(product.barcode);
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  }, [products]);

  const currentGroup =
    groupedProducts.find((group) => group.key === selectedGroup) || null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!currentGroup || !file) {
      setStatus({
        type: "error",
        message: "Selecciona un producto e imagen",
      });
      return;
    }

    try {
      let updated = 0;

      for (const barcode of currentGroup.barcodes) {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(`/api/products/${barcode}/image`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Error al subir imagen");
        }

        const data = await response.json();
        updated += 1;

        if (onImageUploaded) {
          onImageUploaded(barcode, data.product?.imageUrl);
        }
      }

      setStatus({
        type: "success",
        message: `Imagen actualizada para ${updated} código${
          updated === 1 ? "" : "s"
        }.`,
      });
      setFile(null);
      setSelectedGroup("");
      event.target.reset();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  return (
    <section className="image-manager">
      <h2>Cargar imagen de producto</h2>
      <form className="image-manager__form" onSubmit={handleSubmit}>
        <label>
          Producto
          <select
            value={selectedGroup}
            onChange={(event) => {
              setSelectedGroup(event.target.value);
              setStatus(null);
            }}
          >
            <option value="">Selecciona un producto</option>
            {groupedProducts.map((group) => (
              <option key={group.key} value={group.key}>
                {group.displayName}
              </option>
            ))}
          </select>
        </label>

        <div className="file-input-wrapper">
          <label className="file-input-label" htmlFor="file-upload">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>{file ? file.name : 'Seleccionar imagen'}</span>
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setStatus(null);
            }}
            className="file-input-hidden"
          />
        </div>

        <button type="submit" className="submit-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Guardar imagen
        </button>
      </form>

      {status && (
        <p className={`image-manager__status image-manager__status--${status.type}`}>
          {status.message}
        </p>
      )}
    </section>
  );
}

export default ProductImageManager;
