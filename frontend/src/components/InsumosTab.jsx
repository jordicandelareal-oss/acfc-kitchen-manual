import React, { useState, useEffect, useCallback } from 'react';
import { Search, Tag, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchInsumos } from '../api';
import * as mathUtils from '../utils/mathUtils';

const fmt = (n, dec = 4) => mathUtils.fmt(n, dec);
const fmtKg = (n) => mathUtils.fmtKg(n);
const fmtU = (n) => mathUtils.fmtU(n);

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

const InsumoRow = ({ item }) => {
  const [open, setOpen] = useState(false);

  const mainPrice = fmtKg(item.precio_por_kg) || fmtU(item.precio_por_u);
  const pricePerGr = item.precio_por_gramo ? fmt(item.precio_por_gramo, 4) + '/gr' : null;

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
        <div className="item-info" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="item-name">{item.name}</span>
            <NutPill cat={item.nutritional_category} />
          </div>
          <span className="item-meta">
            {[item.category, item.subcategory].filter(Boolean).join(' › ')}
          </span>
        </div>

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

const InsumosTab = ({ loading }) => {
  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
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
  const categories = [...new Set(safeItems.map(i => i?.category).filter(Boolean))].sort();

  const filtered = safeItems.filter(item => {
    const matchSearch = !search ||
      item?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item?.category?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || item?.category === catFilter;
    return matchSearch && matchCat;
  });

  const grouped = filtered.reduce((acc, item) => {
    const cat = item?.category || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div>
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

      <p style={{ fontSize: 11, color: '#475569', margin: '0 0 10px' }}>
        {filtered.length} insumos{catFilter ? ` en "${catFilter}"` : ''}
        {search ? ` · búsqueda: "${search}"` : ''}
      </p>

      {Object.entries(grouped).map(([cat, rows]) => (
        <div key={cat} className="premium-card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
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

export default InsumosTab;
