import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, ShoppingBag, Utensils, RefreshCw,
  AlertTriangle, Package, TrendingUp, ChevronRight,
  LayoutDashboard, Bell, Search, Filter, Tag,
  Euro, Truck, ChevronDown, ChevronUp,
} from 'lucide-react';
import { fetchData, saveData, fetchDashboardStats, fetchInsumos } from './api';
import './index.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n, dec = 4) =>
  n != null && !isNaN(n) ? `€${Number(n).toFixed(dec)}` : '—';

const fmtKg = (n) =>
  n != null && !isNaN(n) ? `€${Number(n).toFixed(2)}/kg` : null;

const fmtU = (n) =>
  n != null && !isNaN(n) ? `€${Number(n).toFixed(2)}/u` : null;

// ─── Badge de stock ───────────────────────────────────────────────────────────
const StockBadge = ({ qty, min }) => {
  if (qty == null) return null;
  const ratio = min > 0 ? qty / min : 1;
  const cls   = ratio <= 0 ? 'badge-danger' : ratio < 1 ? 'badge-warning' : 'badge-ok';
  const label = ratio <= 0 ? '⛔ Agotado'  : ratio < 1 ? '⚠️ Bajo'       : '✅ OK';
  return <span className={`badge ${cls}`}>{label}</span>;
};

// ─── Pill de categoría nutricional ────────────────────────────────────────────
const NutPill = ({ cat }) => {
  if (!cat) return null;
  const colors = {
    'Proteina':    '#22c55e',
    'Proteína':    '#22c55e',
    'H.Carbono':   '#f59e0b',
    'Verdura':     '#10b981',
    'Lacteos':     '#60a5fa',
    'Grasa':       '#f97316',
    'Sin asignar': '#6b7280',
  };
  const bg = colors[cat] || '#8b5cf6';
  return (
    <span style={{
      background: bg + '22', color: bg,
      border: `1px solid ${bg}44`,
      borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 600,
    }}>{cat}</span>
  );
};

// ─── Fila expandible de insumo ────────────────────────────────────────────────
const InsumoRow = ({ item }) => {
  const [open, setOpen] = useState(false);

  // Price display: prefer kg, fallback to unit price
  const mainPrice = fmtKg(item.precio_por_kg) || fmtU(item.precio_por_u);
  const pricePerGr = item.precio_por_gramo ? fmt(item.precio_por_gramo, 4) + '/gr' : null;

  // Proveedores comparison
  const proveedores = item.precios_por_proveedor
    ? Object.entries(item.precios_por_proveedor).sort((a, b) => a[1] - b[1])
    : [];

  return (
    <>
      <div
        className="item-row"
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', flexWrap: 'wrap' }}
      >
        {/* Left: product info */}
        <div className="item-info" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="item-name">{item.name}</span>
            <NutPill cat={item.nutritional_category} />
          </div>
          <span className="item-meta">
            {[item.category, item.subcategory].filter(Boolean).join(' › ')}
          </span>
        </div>

        {/* Right: price + proveedor */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            {mainPrice && (
              <div className="price-badge">{mainPrice}</div>
            )}
            {pricePerGr && (
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{pricePerGr}</div>
            )}
          </div>
          {item.proveedor_principal && (
            <div style={{
              fontSize: 10, background: '#1e293b', color: '#94a3b8',
              border: '1px solid #334155', borderRadius: 6, padding: '2px 7px',
              whiteSpace: 'nowrap',
            }}>
              <Truck size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
              {item.proveedor_principal}
            </div>
          )}
          {open ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
        </div>
      </div>

      {/* Expanded: all provider prices */}
      {open && (
        <div style={{
          background: '#0f172a', borderTop: '1px solid #1e293b',
          padding: '10px 16px 14px', marginBottom: 1,
        }}>
          {proveedores.length > 0 ? (
            <>
              <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 8px', fontWeight: 600 }}>
                COMPARATIVA DE PRECIOS
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {proveedores.map(([prov, precio], i) => (
                  <div key={prov} style={{
                    background: i === 0 ? '#16a34a22' : '#1e293b',
                    border: `1px solid ${i === 0 ? '#16a34a' : '#334155'}`,
                    borderRadius: 8, padding: '5px 10px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    minWidth: 80,
                  }}>
                    <span style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>{prov}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: i === 0 ? '#22c55e' : '#e2e8f0',
                    }}>€{precio.toFixed(2)}</span>
                    {i === 0 && (
                      <span style={{ fontSize: 9, color: '#16a34a' }}>✓ mejor precio</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
              Sin comparativa de proveedores disponible.
            </p>
          )}
          {item.unit && (
            <p style={{ fontSize: 10, color: '#475569', margin: '10px 0 0' }}>
              Unidad de medida: <strong style={{ color: '#94a3b8' }}>{item.unit}</strong>
            </p>
          )}
        </div>
      )}
    </>
  );
};

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────
const DashboardTab = ({ onNavigate }) => {
  const [stats, setStats] = useState({ totalIngredients: 0, lowStockAlerts: 0, pendingOrders: 0 });

  useEffect(() => {
    fetchDashboardStats().then(res => { if (res.success) setStats(res); });
  }, []);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon icon-blue"><Package size={22} /></div>
          <div className="stat-value">{stats.totalIngredients}</div>
          <div className="stat-label">Ingredientes</div>
        </div>
        <div className="stat-card" onClick={() => onNavigate('insumos')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon icon-orange"><AlertTriangle size={22} /></div>
          <div className="stat-value stat-alert">{stats.lowStockAlerts}</div>
          <div className="stat-label">Stock Bajo</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon icon-green"><TrendingUp size={22} /></div>
          <div className="stat-value">{stats.pendingOrders}</div>
          <div className="stat-label">Pedidos Pend.</div>
        </div>
      </div>

      <div className="premium-card" style={{ marginTop: 16 }}>
        <h3 className="section-title">Accesos Rápidos</h3>
        {[
          { icon: <Utensils size={18} />,   label: 'Ver Menú Semanal',    tab: 'menus' },
          { icon: <ShoppingBag size={18} />, label: 'Lista de Compras',    tab: 'compras' },
          { icon: <Package size={18} />,    label: 'Control de Insumos',  tab: 'insumos' },
        ].map(({ icon, label, tab }) => (
          <button key={tab} className="quick-action" onClick={() => onNavigate(tab)}>
            <span className="quick-action-icon">{icon}</span>
            <span>{label}</span>
            <ChevronRight size={16} className="chevron" />
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Tab: Menús ───────────────────────────────────────────────────────────────
const MenusTab = ({ data, loading }) => {
  if (loading) return <div className="loading-spinner" />;
  if (!data.length) return (
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
        {data.map((item, idx) => (
          <div key={idx} className="menu-row">
            <div className="menu-day">{item.planning_date || item.date || item.Día}</div>
            <div className="menu-meals">
              <div className="menu-meal">
                <span className="item-meta">Almuerzo</span>
                <span className="item-name">{item.lunch_recipe || item.Almuerzo || '—'}</span>
              </div>
              <div className="menu-meal" style={{ alignItems: 'flex-end' }}>
                <span className="item-meta">Cena</span>
                <span className="item-name">{item.dinner_recipe || item.Cena || '—'}</span>
              </div>
            </div>
            {(item.side_dish || item.Guarnición) && (
              <div className="menu-garnish">+ {item.side_dish || item.Guarnición}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Tab: Compras ─────────────────────────────────────────────────────────────
const ComprasTab = ({ data, loading, month, onMonthChange }) => {
  if (loading) return <div className="loading-spinner" />;
  const getStock = i => i.stock_actual !== undefined && i.stock_actual !== null ? i.stock_actual : (i.current_stock ?? 0);
  const getMin = i => i.stock_minimo !== undefined && i.stock_minimo !== null ? i.stock_minimo : (i.min_stock ?? 0);
  
  const lowStock = data.filter(i => getStock(i) < getMin(i));
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
          {data.map((item, idx) => {
            const stock = getStock(item);
            const min = getMin(item);
            return (
              <div key={idx} className="item-row">
                <div className="item-info">
                  <span className="item-name">{item.name}</span>
                  <span className="item-meta">
                    Stock: {stock} {item.unit} · Mín: {min} {item.unit}
                    {item.proveedor_principal ? ` · ${item.proveedor_principal}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {item.precio_mas_bajo && (
                    <span className="price-badge">€{Number(item.precio_mas_bajo).toFixed(2)}</span>
                  )}
                  <StockBadge qty={stock} min={min} />
                </div>
              </div>
            );
          })}
          {!data.length && <p className="empty-msg">No hay datos para este mes.</p>}
        </div>
        <button className="btn-primary" style={{ marginTop: 20 }}>
          <ShoppingCart size={20} />
          Generar Pedido Óptimo
        </button>
      </div>
    </div>
  );
};

// ─── Tab: Insumos ─────────────────────────────────────────────────────────────
const InsumosTab = ({ loading }) => {
  const [items,    setItems]    = useState([]);
  const [fetching, setFetching] = useState(true);
  const [search,   setSearch]   = useState('');
  const [catFilter, setCatFilter] = useState('');

  useEffect(() => {
    setFetching(true);
    fetchInsumos().then(res => {
      if (res.success) setItems(res.items);
      setFetching(false);
    });
  }, []);

  if (fetching || loading) return <div className="loading-spinner" />;

  // Unique categories for filter
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();

  const filtered = items.filter(item => {
    const matchSearch = !search ||
      item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || item.category === catFilter;
    return matchSearch && matchCat;
  });

  // Group by category
  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div>
      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: '#64748b',
          }} />
          <input
            type="text"
            placeholder="Buscar insumo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', background: '#1e293b', border: '1px solid #334155',
              borderRadius: 8, color: '#e2e8f0', padding: '8px 10px 8px 30px',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 8, color: '#e2e8f0', padding: '8px 10px',
            fontSize: 12, outline: 'none',
          }}
        >
          <option value="">Todas</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Count */}
      <p style={{ fontSize: 11, color: '#475569', margin: '0 0 10px' }}>
        {filtered.length} insumos{catFilter ? ` en "${catFilter}"` : ''}
        {search ? ` · búsqueda: "${search}"` : ''}
      </p>

      {/* Grouped list */}
      {Object.entries(grouped).map(([cat, rows]) => (
        <div key={cat} className="premium-card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
          {/* Category header */}
          <div style={{
            background: 'linear-gradient(90deg,#1e293b,#0f172a)',
            padding: '8px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#cbd5e1' }}>
              <Tag size={12} style={{ marginRight: 5, verticalAlign: 'middle', color: '#3b82f6' }} />
              {cat}
            </span>
            <span style={{ fontSize: 11, color: '#475569' }}>{rows.length} productos</span>
          </div>
          {/* Rows */}
          <div>
            {rows.map((item, idx) => (
              <InsumoRow key={item.id || idx} item={item} />
            ))}
          </div>
        </div>
      ))}

      {!filtered.length && (
        <p className="empty-msg">
          {items.length === 0
            ? 'No hay insumos en la base de datos. Ejecuta el seed.'
            : 'Sin resultados para tu búsqueda.'}
        </p>
      )}
    </div>
  );
};

// ─── App principal ────────────────────────────────────────────────────────────
function App() {
  const [activeTab,  setActiveTab]  = useState('dashboard');
  const [month,      setMonth]      = useState('Julio');
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const loadData = useCallback(async () => {
    if (activeTab === 'dashboard' || activeTab === 'insumos') return;
    setLoading(true);
    const res = await fetchData(activeTab, month);
    if (res.success) setData(res.items);
    setLoading(false);
  }, [activeTab, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Inicio' },
    { id: 'menus',     icon: <Utensils size={18} />,        label: 'Menús'  },
    { id: 'compras',   icon: <ShoppingBag size={18} />,     label: 'Compras'},
    { id: 'insumos',   icon: <Package size={18} />,         label: 'Insumos'},
  ];

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-inner">
          <div>
            <h1 className="header-title">ACFC Kitchen</h1>
            <p className="header-subtitle">Gestión Gastronómica</p>
          </div>
          {activeTab !== 'dashboard' && activeTab !== 'insumos' && (
            <button onClick={loadData} className="refresh-btn" title="Actualizar datos">
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
          )}
        </div>
        {saveStatus && <div className="save-toast">{saveStatus}</div>}
      </header>

      <main className="content">
        {activeTab === 'dashboard' && <DashboardTab onNavigate={tab => setActiveTab(tab)} />}
        {activeTab === 'menus'     && <MenusTab data={data} loading={loading} />}
        {activeTab === 'compras'   && (
          <ComprasTab
            data={data} loading={loading} month={month}
            onMonthChange={m => setMonth(m)}
          />
        )}
        {activeTab === 'insumos' && (
          <InsumosTab
            loading={loading}
            onUpdate={async (id, fields) => {
              setSaveStatus('Guardando...');
              const res = await saveData('insumos', id, fields);
              setSaveStatus(res.success ? '✅ Guardado' : '❌ Error');
              setTimeout(() => setSaveStatus(''), 2000);
            }}
          />
        )}
      </main>

      <nav className="tabs-nav">
        {tabs.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`tab-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => { setActiveTab(id); setData([]); }}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
