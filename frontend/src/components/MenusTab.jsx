import React from 'react';
import { Utensils } from 'lucide-react';

const MenusTab = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="skeleton-loading-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton-line" style={{ height: 24, width: '40%', background: '#1e293b', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton-row" style={{ height: 60, background: '#1e293b', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }
  const safeData = data || [];
  if (!safeData.length) return (
    <div className="empty-state">
      <Utensils size={40} className="empty-icon" />
      <p>No hay menús planificados.</p>
      <small>Añade planificación desde el panel de administración.</small>
    </div>
  );
  return (
    <div className="premium-card">
      <h2 className="section-title">Menú Semanal</h2>
      <div className="item-list">
        {safeData.map((item, idx) => (
          <div key={idx} className="menu-row">
            <div className="menu-day">{item?.planning_date || item?.date || item?.Día}</div>
            <div className="menu-meals">
              <div className="menu-meal">
                <span className="item-meta">Almuerzo</span>
                <span className="item-name">{item?.lunch_recipe || item?.Almuerzo || '—'}</span>
              </div>
              <div className="menu-meal" style={{ alignItems: 'flex-end' }}>
                <span className="item-meta">Cena</span>
                <span className="item-name">{item?.dinner_recipe || item?.Cena || '—'}</span>
              </div>
            </div>
            {(item?.side_dish || item?.Guarnición) && (
              <div className="menu-garnish">+ {item?.side_dish || item?.Guarnición}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenusTab;
