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

        <label className="file-input">
          Imagen
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
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

