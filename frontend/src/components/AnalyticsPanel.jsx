import { useState, useEffect } from 'react';
import './AnalyticsPanel.css';

function AnalyticsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
      const interval = setInterval(loadAnalytics, 30000); // Actualizar cada 30s
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/summary');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error cargando analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const today = new Date().toISOString().split('T')[0];
    window.open(`/api/export/sales?from=${today}&to=${today}`, '_blank');
  };

  const formatCurrency = (value) => {
    return `$${Math.round(value || 0).toLocaleString('es-CL')}`;
  };

  const getHeatColor = (count, maxCount) => {
    if (maxCount === 0) return '#e0e0e0';
    const ratio = count / maxCount;
    
    // Gradiente de frío a caliente
    if (ratio < 0.2) return '#4a90e2'; // Azul (frío)
    if (ratio < 0.4) return '#50c878'; // Verde
    if (ratio < 0.6) return '#ffd700'; // Amarillo
    if (ratio < 0.8) return '#ff8c00'; // Naranja
    return '#ff4444'; // Rojo (caliente)
  };

  if (!isOpen) {
    return (
      <button className="analytics-toggle-btn" onClick={() => setIsOpen(true)}>
        📊 Analytics
      </button>
    );
  }

  return (
    <div className="analytics-panel">
      <div className="analytics-header">
        <h3>📊 Analytics del Día</h3>
        <div className="analytics-actions">
          <button className="export-btn" onClick={handleExport} title="Exportar CSV">
            📥
          </button>
          <button className="close-btn" onClick={() => setIsOpen(false)}>
            ✕
          </button>
        </div>
      </div>

      {loading && !analytics && (
        <div className="analytics-loading">Cargando...</div>
      )}

      {analytics && (
        <div className="analytics-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <div className="stat-label">Total Ventas</div>
                <div className="stat-value">
                  {formatCurrency(analytics.summary?.total_revenue)}
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📦</div>
              <div className="stat-info">
                <div className="stat-label">Productos</div>
                <div className="stat-value">
                  {analytics.summary?.total_sales || 0}
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⚡</div>
              <div className="stat-info">
                <div className="stat-label">Sincronizados</div>
                <div className="stat-value">
                  {analytics.summary?.synced_count || 0}/{analytics.summary?.total_sales || 0}
                </div>
              </div>
            </div>
          </div>

          {analytics.topProduct && (
            <div className="top-product">
              <div className="top-product-label">🏆 Más Vendido</div>
              <div className="top-product-name">
                {analytics.topProduct.product_name || analytics.topProduct.barcode}
              </div>
              <div className="top-product-stats">
                {analytics.topProduct.count} ventas · {formatCurrency(analytics.topProduct.total)}
              </div>
            </div>
          )}

          {analytics.hourlyData && analytics.hourlyData.length > 0 && (
            <>
              <div className="hourly-chart">
                <div className="chart-label">Ventas por Hora</div>
                <div className="chart-bars">
                  {analytics.hourlyData.map((hour) => {
                    const maxTotal = Math.max(...analytics.hourlyData.map(h => h.total || 0));
                    const height = maxTotal > 0 ? (hour.total / maxTotal) * 100 : 0;
                    
                    return (
                      <div key={hour.hour} className="chart-bar-wrapper">
                        <div 
                          className="chart-bar"
                          style={{ height: `${height}%` }}
                          title={`${hour.hour}:00 - ${hour.count} ventas - ${formatCurrency(hour.total)}`}
                        />
                        <div className="chart-label-x">{hour.hour}h</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="heatmap-chart">
                <div className="chart-label">🔥 Mapa de Calor (8 AM - 10 PM)</div>
                <div className="heatmap-grid">
                  {Array.from({ length: 15 }, (_, i) => {
                    const hour = i + 8; // 8 AM a 22 PM (10 PM)
                    // Ajustar hora UTC restando 3 horas (hour viene en UTC)
                    const utcHour = (hour + 3) % 24; // Convertir hora local a UTC para buscar
                    const hourData = analytics.hourlyData.find(h => h.hour === utcHour);
                    const count = hourData?.count || 0;
                    const maxCount = Math.max(...analytics.hourlyData.map(h => h.count || 0));
                    const color = getHeatColor(count, maxCount);
                    const size = count > 0 ? Math.max(8, Math.min(24, 8 + (count / maxCount) * 16)) : 6;
                    
                    return (
                      <div key={hour} className="heatmap-cell">
                        <div 
                          className="heatmap-dot"
                          style={{ 
                            backgroundColor: color,
                            width: `${size}px`,
                            height: `${size}px`,
                            boxShadow: count > 0 ? `0 0 ${size/2}px ${color}` : 'none'
                          }}
                          title={`${hour}:00 - ${count} ventas - ${formatCurrency(hourData?.total || 0)}`}
                        />
                        <div className="heatmap-label">{hour}h</div>
                      </div>
                    );
                  })}
                </div>
                <div className="heatmap-legend">
                  <span style={{ color: '#4a90e2' }}>❄️ Frío</span>
                  <span style={{ color: '#50c878' }}>🌿</span>
                  <span style={{ color: '#ffd700' }}>☀️</span>
                  <span style={{ color: '#ff8c00' }}>🔶</span>
                  <span style={{ color: '#ff4444' }}>🔥 Caliente</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AnalyticsPanel;
