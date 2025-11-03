import { useState, useMemo } from "react";
import "./ProductImageManager.css";

function ProductImageManager({ products, onImageUploaded }) {
  const [selectedBarcode, setSelectedBarcode] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedBarcode || !file) {
      setStatus({ type: "error", message: "Selecciona un producto e imagen" });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`/api/products/${selectedBarcode}/image`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Error al subir imagen");
      }

      const data = await response.json();
      setStatus({ type: "success", message: "Imagen actualizada correctamente" });
      setFile(null);
      setSelectedBarcode("");
      event.target.reset();
      if (onImageUploaded) {
        onImageUploaded(selectedBarcode, data.product?.imageUrl);
      }
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
            value={selectedBarcode}
            onChange={(e) => {
              setSelectedBarcode(e.target.value);
              setStatus(null);
            }}
          >
            <option value="">Selecciona un producto</option>
            {sortedProducts.map((product) => (
              <option key={product.barcode} value={product.barcode}>
                {product.name} ({product.barcode})
              </option>
            ))}
          </select>
        </label>

        <label className="file-input">
          Imagen
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setStatus(null);
            }}
          />
        </label>

        <button type="submit">Guardar imagen</button>
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



