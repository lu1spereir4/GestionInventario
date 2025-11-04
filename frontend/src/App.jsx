import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";
import SalesList from "./components/SalesList";
import SummaryCard from "./components/SummaryCard";
import VariablePriceModal from "./components/VariablePriceModel";
import ConnectionStatus from "./components/ConnectionStatus";
import ScannerToggle from "./components/ScannerToggle";
import ProductImageManager from "./components/ProductImageManager";

const SOCKET_URL = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : `http://${window.location.hostname}:3001`;

function App() {
  const [sales, setSales] = useState([]);
  const [connected, setConnected] = useState(false);
  const [pendingVariablePrice, setPendingVariablePrice] = useState(null);
  const [products, setProducts] = useState([]);
  const productsRef = useRef([]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const enrichSale = (sale, catalog) =>
    updateSaleWithCatalog(sale, catalog || productsRef.current);

  const enrichSales = (list, catalog) =>
    sortSales((list || []).map((sale) => enrichSale(sale, catalog)));

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/products");
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
          setSales((prev) => enrichSales(prev, data));
          setPendingVariablePrice((prev) =>
            prev ? updateSaleWithCatalog(prev, data) : null
          );
        }
      } catch (error) {
        console.error("Error cargando catálogo local:", error);
      }
    };

    fetchProducts();

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });


    socket.on("connect", () => {
      console.log("🟢 Conectado al servidor");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Desconectado del servidor");
      setConnected(false);
    });

    socket.on("initial-data", (data) => {
      console.log("📦 Datos iniciales recibidos:", data);
      if (Array.isArray(data.products)) {
        setProducts(data.products);
      }
      if (Array.isArray(data.sales)) {
        setSales(enrichSales(data.sales, data.products));
      }
      if (data.pendingVariablePrice) {
        setPendingVariablePrice(enrichSale(data.pendingVariablePrice, data.products));
      }
    });

    socket.on("products-refreshed", (catalog) => {
      if (Array.isArray(catalog)) {
        setProducts(catalog);
        setSales((prev) => enrichSales(prev, catalog));
        setPendingVariablePrice((prev) =>
          prev ? updateSaleWithCatalog(prev, catalog) : null
        );
      }
    });

    socket.on("product-updated", (product) => {
      if (!product?.barcode) return;
      setProducts((prev) => mergeProduct(prev, product));
      setSales((prev) =>
        prev.map((sale) =>
          sale.barcode === product.barcode
            ? { ...sale, imageUrl: product.imageUrl, productName: sale.productName || product.name, category: sale.category || product.category }
            : sale
        )
      );
    });

    socket.on("scan-received", () => {
      playSound("scan");
    });

    socket.on("sale-completed", (sale) => {
      console.log("✅ Venta completada:", sale);
      const enrichedSale = enrichSale(sale);
      setSales((prev) => upsertSale(prev, enrichedSale));
      setProducts((prev) => mergeProduct(prev, {
        barcode: enrichedSale.barcode,
        name: enrichedSale.productName || enrichedSale.barcode,
        category: enrichedSale.category,
        imageUrl: enrichedSale.imageUrl,
      }));
      playSound("success");
    });

    socket.on("sale-updated", (sale) => {
      setSales((prev) => upsertSale(prev, enrichSale(sale)));
    });

    socket.on("variable-price-required", (scan) => {
      console.log("⚠️ Precio variable requerido:", scan);
      setPendingVariablePrice(enrichSale(scan));
      playSound("alert");
    });

    socket.on("sale-rejected", (rejection) => {
      console.error("❌ Venta rechazada:", rejection);
      setSales((prev) =>
        upsertSale(prev, {
          id: rejection.id,
          status: "rejected",
          rejectionReason: rejection.reason,
        })
      );
      playSound("error");
      alert(`Venta rechazada: ${rejection.reason}`);
    });

    socket.on("sync-error", (error) => {
      console.error("Error de sincronización:", error);
    });

    return () => {
      socket.close();
    };
  }, []);

  const playSound = (type) => {
    const frequencies = {
      scan: 800,
      success: 1000,
      alert: 600,
      error: 400,
    };

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequencies[type] || 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const handleVariablePriceSubmit = async (priceCents) => {
    if (!pendingVariablePrice) return;

    try {
      const response = await fetch("/api/set-variable-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scanId: pendingVariablePrice.id,
          priceCents,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al enviar precio");
      }

      setPendingVariablePrice(null);
      playSound("success");
    } catch (error) {
      console.error("Error enviando precio:", error);
      alert(`Error: ${error.message}`);
      playSound("error");
    }
  };

  const handleVariablePriceCancel = () => {
    setPendingVariablePrice(null);
  };

  const handleImageUploaded = (barcode, imageUrl) => {
    if (!barcode) return;
    setProducts((prev) => mergeProduct(prev, { barcode, imageUrl }));
    setSales((prev) =>
      prev.map((sale) =>
        sale.barcode === barcode
          ? { ...sale, imageUrl: imageUrl || sale.imageUrl }
          : sale
      )
    );
  };

  const totalItems = sales.reduce((sum, sale) => sum + (sale.quantity || 1), 0);
  const totalPesos = sales.reduce((sum, sale) => sum + (sale.priceCents || 0), 0);

  const formatCurrency = (value) =>
    `$${Math.max(0, Math.round(value || 0)).toLocaleString("es-CL")}`;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>📦 Sistema de Inventario</h1>
          <ConnectionStatus connected={connected} />
        </div>
      </header>

      <main className="app-main">
        <div className="summary-section">
          <SummaryCard title="Total Productos" value={totalItems} icon="🧾" />
          <SummaryCard
            title="Total Ventas"
            value={formatCurrency(totalPesos)}
            icon="💰"
          />
        </div>

        <ScannerToggle />

        <ProductImageManager
          products={products}
          onImageUploaded={handleImageUploaded}
        />

        <div className="sales-section">
          <h2>Ventas del día</h2>
          <SalesList sales={sales} />
        </div>
      </main>

      {pendingVariablePrice && (
        <VariablePriceModal
          product={pendingVariablePrice}
          onSubmit={handleVariablePriceSubmit}
          onCancel={handleVariablePriceCancel}
        />
      )}
    </div>
  );
}

function mergeProduct(existing, updated) {
  const map = new Map(existing.map((item) => [item.barcode, item]));
  const current = map.get(updated.barcode) || {};
  map.set(updated.barcode, {
    ...current,
    ...updated,
    name: updated.name || current.name || updated.barcode,
  });
  return Array.from(map.values());
}

function updateSaleWithCatalog(sale, catalog = []) {
  const product = Array.isArray(catalog)
    ? catalog.find((item) => item.barcode === sale.barcode)
    : undefined;
  if (!product) return sale;
  const pricingFixed = product.pricingMode === "fixed";
  return {
    ...sale,
    productName: sale.productName || product.name,
    category: sale.category || product.category,
    imageUrl: sale.imageUrl || product.imageUrl,
    priceCents:
      sale.priceCents ?? (pricingFixed ? product.defaultPriceCents ?? null : null),
  };
}

export default App;

function sortSales(items) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.scannedAt || a.scanned_at || 0).getTime();
    const dateB = new Date(b.scannedAt || b.scanned_at || 0).getTime();
    return dateB - dateA;
  });
}

function upsertSale(existing, sale) {
  if (!sale || !sale.id) {
    return existing;
  }

  const map = new Map(existing.map((item) => [item.id, item]));
  const current = map.get(sale.id) || {};
  map.set(sale.id, {
    ...current,
    ...sale,
    scannedAt:
      sale.scannedAt ||
      sale.scanned_at ||
      current.scannedAt ||
      current.scanned_at ||
      new Date().toISOString(),
  });
  return sortSales(Array.from(map.values()));
}


