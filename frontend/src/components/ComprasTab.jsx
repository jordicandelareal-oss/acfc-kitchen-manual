import React from 'react';
import { Bell, ShoppingCart } from 'lucide-react';
import * as mathUtils from '../utils/mathUtils';

const StockBadge = ({ qty, min }) => {
  if (qty == null) return null;
  const ratio = min > 0 ? qty / min : 1;
  const cls   = ratio <= 0 ? 'badge-danger' : ratio < 1 ? 'badge-warning' : 'badge-ok';
  const label = ratio <= 0 ? '⛔ Agotado'  : ratio < 1 ? '⚠️ Bajo'       : '✅ OK';
  return <span className={`badge ${cls}`}>{label}</span>;
};

const ComprasTab = ({ data, loading, month, onMonthChange }) => {
  if (loading) {
    return (
      <div className="skeleton-loading-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton-line" style={{ height: 24, width: '30%', background: '#1e293b', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton-row" style={{ height: 50, background: '#1e293b', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }
  const safeData = data || [];
  const getStock = i => i?.stock_actual !== undefined && i?.stock_actual !== null ? i.stock_actual : (i?.current_stock ?? 0);
  const getMin = i => i?.stock_minimo !== undefined && i?.stock_minimo !== null ? i.stock_minimo : (i?.min_stock ?? 0);
  
  const lowStock = safeData.filter(i => getStock(i) < getMin(i));
  return (
    <div>
      {lowStock.length > 0 && (
        <div className="alert-banner">
          <Bell size={16} />
          <span>{lowStock.length} ingrediente(s) por debajo del stock mínimo</span>
        </div>
      )}
      <div className="premium-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Lista de Compras</h2>
          <select className="month-select" value={month} onChange={e => onMonthChange(e.target.value)}>
            {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
              'Septiembre','Octubre','Noviembre','Diciembre'].map(m =>
              <option key={m}>{m}</option>
            )}
          </select>
        </div>
        <div className="item-list">
          {safeData.map((item, idx) => {
            const stock = getStock(item);
            const min = getMin(item);
            return (
              <div key={idx} className="item-row">
                <div className="item-info">
                  <span className="item-name">{item?.name}</span>
                  <span className="item-meta">
                    Stock: {stock} {item?.unit} · Mín: {min} {item?.unit}
                    {item?.proveedor_principal ? ` · ${item.proveedor_principal}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {item?.precio_mas_bajo && (
                    <span className="price-badge">€{Number(item.precio_mas_bajo).toFixed(2)}</span>
                  )}
                  <StockBadge qty={stock} min={min} />
                </div>
              </div>
            );
          })}
          {!safeData.length && <p className="empty-msg">No hay datos para este mes.</p>}
        </div>
        <button className="btn-primary" style={{ marginTop: 20 }}>
          <ShoppingCart size={20} />
          Generar Pedido Óptimo
        </button>
      </div>
    </div>
  );
};

export default ComprasTab;
