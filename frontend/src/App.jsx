import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, ShoppingBag, Utensils, RefreshCw,
  AlertTriangle, Package, TrendingUp, ChevronRight,
  LayoutDashboard, Bell, Search, Filter, Tag,
  Euro, Truck, ChevronDown, ChevronUp, Edit2, Check, X, Shield, Activity
} from 'lucide-react';
import { fetchData, saveData, fetchDashboardStats, fetchInsumos, fetchRecipesWithIngredients, fetchRecipes } from './api';
import SplashScreen from './SplashScreen';
import './index.css';
import * as mathUtils from './utils/mathUtils';
import { supabase } from './supabaseClient';

import DashboardTab from './components/DashboardTab';
import InventoryTab from './components/InventoryTab';
import RecipesTab from './components/RecipesTab';
import SuppliersTab from './components/SuppliersTab';
import PlannerTab from './components/PlannerTab';


// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n, dec = 4) => mathUtils.fmt(n, dec);
const fmtKg = (n) => mathUtils.fmtKg(n);
const fmtU = (n) => mathUtils.fmtU(n);


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

  // Proveedores comparison safely
  let preciosObj = {};
  if (item.precios_por_proveedor) {
    if (typeof item.precios_por_proveedor === 'string') {
      try {
        preciosObj = JSON.parse(item.precios_por_proveedor);
      } catch (e) {
        console.warn('Error parsing precios_por_proveedor string:', e);
      }
    } else if (typeof item.precios_por_proveedor === 'object') {
      preciosObj = item.precios_por_proveedor;
    }
  }
  const proveedores = preciosObj
    ? Object.entries(preciosObj).sort((a, b) => {
        const valA = Number(a[1]) || 0;
        const valB = Number(b[1]) || 0;
        return valA - valB;
      })
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

// ─── Tab: Dashboard (Migrado a components/DashboardTab.jsx) ───────────────────

// ─── Tab: Menús ───────────────────────────────────────────────────────────────
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

// ─── Tab: Compras ─────────────────────────────────────────────────────────────
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

// ─── Tab: Insumos ─────────────────────────────────────────────────────────────
const InsumosTab = ({ loading }) => {
  const [items,    setItems]    = useState([]);
  const [fetching, setFetching] = useState(true);
  const [search,   setSearch]   = useState('');
  const [catFilter, setCatFilter] = useState('');

  const refreshInventory = useCallback(() => {
    setFetching(true);
    fetchInsumos().then(res => {
      if (res && res.success) setItems(res.items || []);
      setFetching(false);
    }).catch(e => {
      console.error(e);
      setFetching(false);
    });
  }, []);

  useEffect(() => {
    refreshInventory();
    window.refreshReactInventory = refreshInventory;
    return () => {
      window.refreshReactInventory = null;
    };
  }, [refreshInventory]);

  if (fetching || loading) {
    return (
      <div className="skeleton-loading-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton-line" style={{ height: 35, background: '#1e293b', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
        {[1, 2].map(i => (
          <div key={i} className="skeleton-row" style={{ height: 80, background: '#1e293b', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  const safeItems = items || [];
  // Unique categories for filter
  const categories = [...new Set(safeItems.map(i => i?.category).filter(Boolean))].sort();

  const filtered = safeItems.filter(item => {
    const matchSearch = !search ||
      item?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item?.category?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || item?.category === catFilter;
    return matchSearch && matchCat;
  });

  // Group by category
  const grouped = filtered.reduce((acc, item) => {
    const cat = item?.category || 'Sin categoría';
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
            <span style={{ fontSize: 11, color: '#475569' }}>{rows?.length || 0} productos</span>
          </div>
          {/* Rows */}
          <div>
            {(rows || []).map((item, idx) => (
              <InsumoRow key={item?.id || idx} item={item} />
            ))}
          </div>
        </div>
      ))}

      {!filtered.length && (
        <p className="empty-msg">
          {safeItems.length === 0
            ? 'No hay insumos en la base de datos. Ejecuta el seed.'
            : 'Sin resultados para tu búsqueda.'}
        </p>
      )}
    </div>
  );
};

// ─── App principal ────────────────────────────────────────────────────────────
function App() {
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('introPlayed');
  });
  const [activeTab,  setActiveTab]  = useState('dashboard');
  const [month,      setMonth]      = useState('Julio');
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem('acfc_user_role') || 'jefe_cocina');
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [globalRecipes, setGlobalRecipes] = useState([]);

  const loadLowStockAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('id, name, stock_actual, stock_minimo, unit, stock_reservado');
      if (!error && data) {
        const alerts = data.filter(i => {
          const stock = Number(i.stock_actual) || 0;
          const min = Number(i.stock_minimo) || 0;
          const reserved = Number(i.stock_reservado) || 0;
          return (stock - reserved) <= min;
        });
        setLowStockAlerts(alerts);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (notificationsOpen) {
      loadLowStockAlerts();
    }
  }, [notificationsOpen, loadLowStockAlerts]);

  // Load recipes globally on startup
  const loadGlobalRecipes = useCallback(async () => {
    try {
      const { data, error } = await fetchRecipesWithIngredients();
      if (!error && data) {
        setGlobalRecipes(data);
        window.ALL_RECIPES = data;
        window.RECIPES = data;
      } else {
        const { data: flatData } = await fetchRecipes();
        const recs = flatData || [];
        setGlobalRecipes(recs);
        window.ALL_RECIPES = recs;
        window.RECIPES = recs;
      }
    } catch (e) {
      console.error('Error loading global recipes:', e);
    }
  }, []);

  useEffect(() => {
    loadGlobalRecipes();
  }, [loadGlobalRecipes]);

  // Interoperabilidad con código legacy del index.html
  useEffect(() => {
    window.showScreen = (id) => {
      if (id === 'recetas') {
        setActiveTab('recipes');
      } else if (id === 'proveedores') {
        setActiveTab('suppliers');
      } else if (id === 'inventory') {
        setActiveTab('inventory');
      } else if (id === 'planner') {
        setActiveTab('planner');
      } else if (id === 'recipes') {
        setActiveTab('recipes');
      } else {
        setActiveTab(id);
      }
      setMobileMenuOpen(false);
    };

    window.openNewModal = () => setNewModalOpen(true);
    window.closeNewModal = () => setNewModalOpen(false);
    window.openNotificationsModal = () => setNotificationsOpen(true);
    window.openMenuSettingsModal = () => setSettingsOpen(true);
    window.openProfileCjModal = () => setProfileOpen(true);

    return () => {
      window.openNewModal = null;
      window.closeNewModal = null;
      window.openNotificationsModal = null;
      window.openMenuSettingsModal = null;
      window.openProfileCjModal = null;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (activeTab === 'dashboard' || activeTab === 'inventory' || activeTab === 'recipes' || activeTab === 'suppliers' || activeTab === 'planner') return;
    setLoading(true);
    try {
      const res = await fetchData(activeTab, month);
      if (res && res.success) {
        setData(res.items || []);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tabs = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { id: 'inventory', icon: <Package size={18} />,         label: 'Inventario' },
    { id: 'recipes',   icon: <Utensils size={18} />,        label: 'Recetas' },
    { id: 'suppliers', icon: <Truck size={18} />,           label: 'Proveedores' },
    { id: 'planner',   icon: <ShoppingCart size={18} />,     label: 'Planificador' },
  ];

  return (
    <>
      {showIntro && (
        <SplashScreen
          onFinished={() => {
            sessionStorage.setItem('introPlayed', 'true');
            setShowIntro(false);
          }}
        />
      )}
      <div className="app-container">
      {/* ── NAVBAR REACT MIGRADA DESDE HTML ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200" style={{ boxShadow: '0 1px 8px rgba(15,23,42,.06)' }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between gap-4">
          
          {/* Left: Logo + hamburger */}
          <div className="flex items-center gap-3">
            <button 
              id="hamburger-btn" 
              onClick={() => setMobileMenuOpen(o => !o)} 
              className="md:hidden flex items-center justify-center p-2 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors" 
              aria-label="Abrir menú"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>menu</span>
            </button>
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-9 h-9 rounded-xl bg-brand-muted flex items-center justify-center overflow-hidden">
                <img 
                  src="logo.png" 
                  alt="ACFC Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => { e.target.outerHTML = '<span class="material-symbols-outlined" style="color:#4f46e5;font-size:22px">restaurant</span>'; }}
                />
              </div>
              <span className="font-display font-bold text-slate-900 text-[17px] tracking-tight" style={{ fontFamily: 'Outfit' }}>ACFC Kitchen</span>
              <span className="hidden sm:inline-block badge badge-indigo ml-1">Pro</span>
            </div>
          </div>

          {/* Center: Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map(tab => (
              <a 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)} 
                className={`nav-link cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id ? 'active bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {tab.icon}
                {tab.label}
              </a>
            ))}
          </nav>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => setNewModalOpen(true)} className="flex items-center gap-1.5 bg-brand text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-brand-dark transition-colors shadow-sm" style={{ fontFamily: 'Inter' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              <span className="hidden sm:inline">Nuevo</span>
            </button>
            <button onClick={() => setNotificationsOpen(true)} className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" aria-label="Notificaciones">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>notifications</span>
              {lowStockAlerts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full pulse-red"></span>}
            </button>
            <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors hidden sm:flex" aria-label="Ajustes">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>settings</span>
            </button>
            <div onClick={() => setProfileOpen(true)} className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-white font-bold text-sm cursor-pointer" title="Chef Jefe">CJ</div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <div id="mobile-nav" className="md:hidden border-t border-slate-100 bg-white pb-3">
            <div className="px-4 pt-2 space-y-1">
              {tabs.map(tab => (
                <a 
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }} 
                  className={`nav-link w-full cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'active bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {tab.icon}
                  {tab.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT CON PESTAÑAS REACT MODULARES MIGRADAS ── */}
      <main className="content">
        {activeTab === 'dashboard' && <DashboardTab onNavigate={tab => setActiveTab(tab)} recipes={globalRecipes} role={role} setRole={setRole} />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'recipes' && <RecipesTab recipes={globalRecipes} reloadRecipes={loadGlobalRecipes} />}
        {activeTab === 'suppliers' && <SuppliersTab />}
        {activeTab === 'planner' && <PlannerTab recipes={globalRecipes} />}
      </main>

      {/* Mobile Footer Tab Bar */}
      <nav className="tabs-nav md:hidden">
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

      {/* ── MODAL: NUEVO REGISTRO EN REACT ── */}
      {newModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setNewModalOpen(false); }}>
          <div className="modal-box">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Crear nuevo elemento</h3>
              <button onClick={() => setNewModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">¿Qué tipo de recurso deseas añadir al sistema?</p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setNewModalOpen(false); setActiveTab('inventory'); if (typeof window.toast === 'function') window.toast('🥦 Añade un ingrediente en la sección Inventario'); }}
                className="flex flex-col items-center gap-2 p-5 border border-slate-200 rounded-xl hover:border-brand hover:bg-brand-muted transition-all group"
              >
                <span className="material-symbols-outlined text-3xl text-brand">inventory_2</span>
                <span className="text-sm font-semibold text-slate-700 group-hover:text-brand">Ingrediente</span>
              </button>
              <button 
                onClick={() => { setNewModalOpen(false); setActiveTab('recipes'); if (typeof window.toast === 'function') window.toast('📋 Añade una receta en Escandallos'); }}
                className="flex flex-col items-center gap-2 p-5 border border-slate-200 rounded-xl hover:border-brand hover:bg-brand-muted transition-all group"
              >
                <span className="material-symbols-outlined text-3xl text-brand">receipt_long</span>
                <span className="text-sm font-semibold text-slate-700 group-hover:text-brand">Receta</span>
              </button>
              <button 
                onClick={() => { setNewModalOpen(false); setActiveTab('suppliers'); if (typeof window.toast === 'function') window.toast('🚚 Añade un proveedor en el directorio'); }}
                className="flex flex-col items-center gap-2 p-5 border border-slate-200 rounded-xl hover:border-success hover:bg-success-light transition-all group"
              >
                <span className="material-symbols-outlined text-3xl text-success">local_shipping</span>
                <span className="text-sm font-semibold text-slate-700 group-hover:text-success">Proveedor</span>
              </button>
              <button 
                onClick={() => { setNewModalOpen(false); setActiveTab('planner'); if (typeof window.toast === 'function') window.toast('📅 Planifica el menú en el Planificador'); }}
                className="flex flex-col items-center gap-2 p-5 border border-slate-200 rounded-xl hover:border-warn hover:bg-warn-light transition-all group"
              >
                <span className="material-symbols-outlined text-3xl text-warn">calendar_month</span>
                <span className="text-sm font-semibold text-slate-700 group-hover:text-warn">Menú del día</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL: NOTIFICACIONES ── */}
      {notificationsOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setNotificationsOpen(false); }}>
          <div className="modal-box w-full max-w-md flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-brand" />
                <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Centro de Notificaciones</h3>
              </div>
              <button onClick={() => setNotificationsOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {lowStockAlerts.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6 italic">No tienes nuevas notificaciones.</p>
              ) : (
                lowStockAlerts.map(alert => (
                  <div key={alert.id} className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5">
                    <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{alert.name} bajo de stock</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Stock actual: {alert.stock_actual} {alert.unit} (Mín: {alert.stock_minimo} {alert.unit})
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIGURACIÓN / AJUSTES ── */}
      {settingsOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className="modal-box w-full max-w-md flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-5 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>⚙️ Configuración del Sistema</h3>
                <p className="text-xs text-slate-400 mt-0.5">Establece preferencias globales de la cocina</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Rol Switcher inside Settings */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                  <Shield size={13} className="text-brand" />
                  <span>Perfil de Acceso Activo</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <button 
                    onClick={() => {
                      setRole('jefe_cocina');
                      localStorage.setItem('acfc_user_role', 'jefe_cocina');
                      if (typeof window.toast === 'function') window.toast('👤 Perfil cambiado a Jefe de Cocina');
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${role === 'jefe_cocina' ? 'bg-white border-slate-200 text-slate-800 shadow-sm' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                  >
                    Jefe de Cocina
                  </button>
                  <button 
                    onClick={() => {
                      setRole('administrador');
                      localStorage.setItem('acfc_user_role', 'administrador');
                      if (typeof window.toast === 'function') window.toast('👤 Perfil cambiado a Administrador');
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${role === 'administrador' ? 'bg-brand border-brand text-white shadow-sm' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                  >
                    Administrador
                  </button>
                </div>
              </div>

              {/* Kitchen Rules Toggles */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-slate-700">Reglas y Preferencias</p>
                <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                  <span className="text-slate-600 font-medium">Validación automática de stock</span>
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-brand focus:ring-brand" />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                  <span className="text-slate-600 font-medium">Alertas por correo de pedidos</span>
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-brand focus:ring-brand" />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                  <span className="text-slate-600 font-medium">Auto-guardado en la nube</span>
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-brand focus:ring-brand" />
                </label>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PERFIL CJ ── */}
      {profileOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setProfileOpen(false); }}>
          <div className="modal-box w-full max-w-sm flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-5 flex-shrink-0">
              <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Perfil del Usuario</h3>
              <button onClick={() => setProfileOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="flex flex-col items-center text-center p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-white font-bold text-2xl shadow-md mb-3">CJ</div>
                <h4 className="font-bold text-slate-800 text-sm">Chef Jefe (Samir)</h4>
                <span className="px-2.5 py-0.5 bg-brand-muted text-brand text-[10px] font-bold rounded-full mt-1">
                  {role === 'administrador' ? 'Administrador' : 'Jefe de Cocina'}
                </span>
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Email</span>
                  <span className="text-slate-700 font-semibold">samir.cairo@acfc.com</span>
                </div>
                <div className="flex justify-between p-2.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Establecimiento</span>
                  <span className="text-slate-700 font-semibold">ACFC Kitchen Principal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default App;
