import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, Copy, Printer, Package, ChevronDown, ChevronRight, MessageSquare, Mail, Loader2 } from 'lucide-react';
import { generarListaComprasOptimizada } from '../api';

const SUPPLIER_COLORS = {
  'Carnicería El Cairo': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  default:              { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-600' }
};

function getSupplierColors(name) {
  if (name && name.toLowerCase().includes('cairo')) return SUPPLIER_COLORS['Carnicería El Cairo'];
  return SUPPLIER_COLORS.default;
}

export default function ShoppingListModal({ isOpen, onClose }) {
  const [collapsed, setCollapsed] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawList, setRawList] = useState([]);

  // Fetch the calculated list from database via RPC
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      generarListaComprasOptimizada()
        .then(({ data, error: rpcError }) => {
          if (rpcError) throw rpcError;
          setRawList(data || []);
        })
        .catch(err => {
          console.error('Error al generar lista de compras:', err);
          setError(err.message || 'Error inesperado al cargar.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen]);

  // Group items by supplier using reduce() based on the supplier column 'proveedor'
  // Consolidating only non-El Cairo items by ingredient name
  const listaPorProveedor = React.useMemo(() => {
    const grouped = rawList.reduce((acc, item) => {
      const provName = (item.proveedor || 'Sin proveedor asignado').trim();
      if (!acc[provName]) acc[provName] = [];

      if (provName === 'Carnicería El Cairo') {
        // No agrupar por nombre_ingrediente. Mostrar cada fila individualmente (clonando el objeto).
        acc[provName].push({ ...item });
      } else {
        // Buscar si ya existe este ingrediente para consolidar
        const existing = acc[provName].find(i => i.nombre_ingrediente === item.nombre_ingrediente);
        if (existing) {
          existing.cantidad_necesaria = Number(existing.cantidad_necesaria) + Number(item.cantidad_necesaria);
          existing.a_comprar = Number(existing.a_comprar) + Number(item.a_comprar);
          // Concatenar destinos únicos si existen
          const currentDests = existing.destinations ? existing.destinations.split(', ').map(d => d.trim()) : [];
          const itemDests = item.destinations ? item.destinations.split(', ').map(d => d.trim()) : [];
          const destSet = new Set([...currentDests, ...itemDests]);
          existing.destinations = Array.from(destSet).join(', ');
        } else {
          // Copiar el objeto para no mutar el estado original
          acc[provName].push({ ...item });
        }
      }
      return acc;
    }, {});

    // Sort: El Cairo first, then alphabetical, then "Sin proveedor" last
    const sorted = {};
    const keys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Carnicería El Cairo') return -1;
      if (b === 'Carnicería El Cairo') return 1;
      if (a === 'Sin proveedor asignado') return 1;
      if (b === 'Sin proveedor asignado') return -1;
      return a.localeCompare(b);
    });
    keys.forEach(k => { sorted[k] = grouped[k]; });
    return sorted;
  }, [rawList]);

  const totalProviders = Object.keys(listaPorProveedor).length;
  const totalItems = rawList.length;

  // Infiere la unidad de medida según el nombre del ingrediente
  const inferUnit = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('aceite') || n.includes('leche') || n.includes('zumo') || n.includes('vinagre') || n.includes('caldo') || n.includes('vino')) {
      return 'ml';
    }
    if (n.includes('huevo') || n.includes('unidad') || n.includes('pan') || n.includes('lata') || n.includes('tortilla')) {
      return 'ud';
    }
    return 'g';
  };

  const handleCopy = () => {
    const lines = [];
    Object.entries(listaPorProveedor).forEach(([prov, items]) => {
      lines.push(`\n=== ${prov.toUpperCase()} ===`);
      items.forEach(item => {
        const isElCairo = prov.toLowerCase().includes('cairo');
        const unit = inferUnit(item.nombre_ingrediente);
        
        const qty = isElCairo
          ? `${(Number(item.a_comprar) / 1000).toFixed(2)} kg`
          : (unit === 'g' ? `${(Number(item.a_comprar) / 1000).toFixed(2)} kg` : `${Number(item.a_comprar).toFixed(0)} ${unit}`);
          
        lines.push(`  - ${item.nombre_ingrediente}: ${qty}`);
      });
    });
    navigator.clipboard.writeText(lines.join('\n'));
    alert('📋 Lista de compras copiada al portapapeles.');
  };

  const handleSendSupplier = (provName, method) => {
    const items = listaPorProveedor[provName] || [];
    if (items.length === 0) return;

    // Obtener detalles mock/por defecto si no vienen del join
    const phone = '+34600000000';
    const email = 'pedidos@proveedor.com';

    // Generar cuerpo del mensaje
    const header = `📋 *PEDIDO DE COMPRA ACFC KITCHEN*\nProveedor: ${provName}\nFecha: ${new Date().toLocaleDateString()}\n\n*Productos a solicitar:*`;
    const lines = items.map(item => {
      const isElCairo = provName.toLowerCase().includes('cairo');
      const unit = inferUnit(item.nombre_ingrediente);
      
      const qty = isElCairo
        ? `${(Number(item.a_comprar) / 1000).toFixed(2)} kg`
        : (unit === 'g' ? `${(Number(item.a_comprar) / 1000).toFixed(2)} kg` : `${Number(item.a_comprar).toFixed(0)} ${unit}`);
        
      return `• ${item.nombre_ingrediente}: *${qty}*`;
    });
    const messageText = `${header}\n${lines.join('\n')}\n\nPor favor confirmar recepción.`;

    if (method === 'whatsapp') {
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
      window.open(url, '_blank');
    } else if (method === 'email') {
      const subject = encodeURIComponent(`Pedido de Suministros - ACFC Kitchen`);
      const body = encodeURIComponent(messageText.replace(/\*/g, ''));
      const url = `mailto:${email}?subject=${subject}&body=${body}`;
      window.open(url, '_blank');
    }
  };

  const toggleSection = (prov) =>
    setCollapsed(prev => ({ ...prev, [prov]: !prev[prov] }));

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-box max-w-3xl max-h-[88vh] flex flex-col animate-fade-in">

        {/* ── Header ── */}
        <div className="flex justify-between items-start mb-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-brand" size={22} />
              <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
                Lista de Compras
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Consolidado e insumos calculados en Supabase (`generar_lista_compras_optimizada`)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {totalItems} ingredientes · {totalProviders} proveedores
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="text-brand animate-spin" size={32} />
              <span className="text-xs text-slate-400 font-semibold">Calculando compras en Supabase...</span>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-500 text-xs font-semibold">
              ⚠️ {error}
            </div>
          ) : totalItems === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16 italic">
              No hay ingredientes para la planificación actual.<br />
              <span className="text-xs">Genera un menú primero.</span>
            </p>
          ) : (
            Object.entries(listaPorProveedor).map(([provName, items]) => {
              const colors = getSupplierColors(provName);
              const isOpen_ = !collapsed[provName];
              const isElCairo = provName === 'Carnicería El Cairo';
              const hasItemsToBuy = items.some(i => Number(i.a_comprar) > 0);

              return (
                <div key={provName} className={`border ${colors.border} rounded-xl overflow-hidden shadow-sm`}>
                  {/* Section header */}
                  <div className={`w-full flex items-center justify-between p-3 ${colors.bg}`}>
                    <button
                      onClick={() => toggleSection(provName)}
                      className="flex items-center gap-2 text-left flex-grow"
                    >
                      <Package size={14} className={colors.text} />
                      <span className={`font-bold text-xs uppercase tracking-wider ${colors.text}`}>
                        {provName}
                        {isElCairo && <span className="ml-2 text-[10px] font-semibold bg-red-200 text-red-700 px-1.5 py-0.5 rounded">🥩 Carnicería</span>}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                        {items.length} ítem{items.length !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {/* ── Botones de Comunicación con Proveedores ── */}
                    {provName !== 'Sin proveedor asignado' && hasItemsToBuy && (
                      <div className="flex items-center gap-1.5 mr-2">
                        <button
                          onClick={() => handleSendSupplier(provName, 'whatsapp')}
                          className="flex items-center gap-1 p-1 px-2 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                          title="Enviar por WhatsApp"
                        >
                          <MessageSquare size={11} /> WhatsApp
                        </button>
                        <button
                          onClick={() => handleSendSupplier(provName, 'email')}
                          className="flex items-center gap-1 p-1 px-2 text-[10px] font-bold bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                          title="Enviar por Correo"
                        >
                          <Mail size={11} /> Correo
                        </button>
                      </div>
                    )}

                    <button onClick={() => toggleSection(provName)} className="p-1">
                      {isOpen_
                        ? <ChevronDown size={14} className="text-slate-400" />
                        : <ChevronRight size={14} className="text-slate-400" />
                      }
                    </button>
                  </div>

                  {/* Section body */}
                  {isOpen_ && (
                    <div className="bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="px-4 py-2">Ingrediente</th>
                            {isElCairo && <th className="px-3 py-2 text-center">Corte</th>}
                            <th className="px-3 py-2 text-right">Cantidad Requerida</th>
                            <th className="px-3 py-2 text-right">A Comprar (Neto)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {items.map((item, idx) => {
                            const unit = inferUnit(item.nombre_ingrediente);
                            
                            const reqQty = isElCairo
                              ? `${(Number(item.cantidad_necesaria) / 1000).toFixed(2)} kg`
                              : (unit === 'g' ? `${(Number(item.cantidad_necesaria) / 1000).toFixed(2)} kg` : `${Number(item.cantidad_necesaria).toFixed(0)} ${unit}`);

                            const buyQty = isElCairo
                              ? `${(Number(item.a_comprar) / 1000).toFixed(2)} kg`
                              : (unit === 'g' ? `${(Number(item.a_comprar) / 1000).toFixed(2)} kg` : `${Number(item.a_comprar).toFixed(0)} ${unit}`);

                            return (
                              <tr key={item.fila_id || idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-2.5 font-semibold text-slate-800">
                                  {item.nombre_ingrediente}
                                </td>
                                {isElCairo && (
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 rounded border border-red-100">
                                      {item.corte || 'Entera'}
                                    </span>
                                  </td>
                                )}
                                <td className="px-3 py-2.5 text-right text-slate-500 font-medium">
                                  {reqQty}
                                </td>
                                <td className="px-3 py-2.5 text-right font-extrabold text-slate-900">
                                  {Number(item.a_comprar) > 0 ? (
                                    <span className="text-red-600 font-bold">{buyQty}</span>
                                  ) : (
                                    <span className="text-emerald-600 font-medium">✓ En stock</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div className="pt-4 border-t border-slate-100 flex justify-between items-center flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              <Copy size={13} /> Copiar lista
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              <Printer size={13} /> Imprimir
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
