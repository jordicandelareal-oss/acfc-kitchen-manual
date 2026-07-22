import React, { useState, useMemo } from 'react';
import { Bell, ShoppingCart, CheckCircle2, PackageCheck, Search, X } from 'lucide-react';
import * as mathUtils from '../utils/mathUtils';
import { validarRecepcionPedido } from '../api';

const StockBadge = ({ qty, min }) => {
  if (qty == null) return null;
  const ratio = min > 0 ? qty / min : 1;
  const cls   = ratio <= 0 ? 'badge-danger' : ratio < 1 ? 'badge-warning' : 'badge-ok';
  const label = ratio <= 0 ? '⛔ Agotado'  : ratio < 1 ? '⚠️ Bajo'       : '✅ OK';
  return <span className={`badge ${cls}`}>{label}</span>;
};

const ComprasTab = ({ data, loading, month, onMonthChange, onRefresh }) => {
  const [receptionModalOpen, setReceptionModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [receivedQtyMap, setReceivedQtyMap] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const safeData = data || [];

  const getStock = i => i?.stock_actual !== undefined && i?.stock_actual !== null ? Number(i.stock_actual) : (Number(i?.current_stock) || 0);
  const getMin = i => i?.stock_minimo !== undefined && i?.stock_minimo !== null ? Number(i.stock_minimo) : (Number(i?.min_stock) || 0);
  const getReserved = i => Number(i?.stock_reservado) || 0;

  const lowStock = useMemo(() => safeData.filter(i => getStock(i) < getMin(i)), [safeData]);

  // Pre-fill reception modal with low stock items or all items
  const openReceptionModal = () => {
    const initialMap = {};
    safeData.forEach(item => {
      const stock = getStock(item);
      const min = getMin(item);
      const reserved = getReserved(item);
      const needed = Math.max(0, (min + reserved) - stock);
      if (needed > 0) {
        initialMap[item.id] = needed;
      }
    });
    setReceivedQtyMap(initialMap);
    setSearchTerm('');
    setReceptionModalOpen(true);
  };

  const handleQtyChange = (ingId, val) => {
    const num = parseFloat(val);
    setReceivedQtyMap(prev => ({
      ...prev,
      [ingId]: isNaN(num) ? '' : num
    }));
  };

  const handleConfirmReception = async () => {
    const itemsToUpdate = Object.entries(receivedQtyMap)
      .map(([ingredient_id, qty]) => ({
        ingredient_id,
        cantidad_recibida: Number(qty) || 0
      }))
      .filter(i => i.cantidad_recibida > 0);

    if (itemsToUpdate.length === 0) {
      if (window.toast) window.toast('⚠️ Introduce al menos una cantidad recibida mayor a 0');
      return;
    }

    setSubmitting(true);
    try {
      const res = await validarRecepcionPedido(itemsToUpdate);
      if (res.error) throw res.error;

      if (window.toast) window.toast(`✅ Entrada de albarán confirmada (${itemsToUpdate.length} insumos actualizados)`);
      setReceptionModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
      if (window.toast) window.toast('❌ Error al validar la recepción de pedido: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredModalItems = useMemo(() => {
    if (!searchTerm.trim()) return safeData;
    const term = searchTerm.toLowerCase();
    return safeData.filter(i => (i.name || '').toLowerCase().includes(term));
  }, [safeData, searchTerm]);

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

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl p-3 flex items-center gap-3">
          <Bell size={18} className="text-amber-500 flex-shrink-0" />
          <span className="text-xs font-semibold">{lowStock.length} ingrediente(s) por debajo del stock mínimo</span>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Gestión de Compras y Pedidos</h2>
            <p className="text-xs text-slate-500">Revisión de necesidades e ingreso de albaranes de recepción</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="month-select" value={month} onChange={e => onMonthChange(e.target.value)}>
              {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
                'Septiembre','Octubre','Noviembre','Diciembre'].map(m =>
                <option key={m}>{m}</option>
              )}
            </select>
            <button 
              onClick={openReceptionModal} 
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <PackageCheck size={16} />
              <span>Validar Recepción de Pedido</span>
            </button>
          </div>
        </div>

        <div className="item-list divide-y divide-slate-100">
          {safeData.map((item, idx) => {
            const stock = getStock(item);
            const min = getMin(item);
            const reserved = getReserved(item);
            return (
              <div key={idx} className="py-3 flex items-center justify-between gap-3">
                <div className="item-info">
                  <span className="font-semibold text-slate-800 text-sm">{item?.name}</span>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>Stock: <strong className="text-slate-700">{stock} {item?.unit}</strong></span>
                    <span>·</span>
                    <span>Reservado: <strong className="text-indigo-600">{reserved} {item?.unit}</strong></span>
                    <span>·</span>
                    <span>Mín: {min} {item?.unit}</span>
                    {item?.proveedor_principal && (
                      <>
                        <span>·</span>
                        <span className="text-slate-500 font-medium">{item.proveedor_principal}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item?.precio_mas_bajo && (
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">€{Number(item.precio_mas_bajo).toFixed(2)}</span>
                  )}
                  <StockBadge qty={stock} min={min} />
                </div>
              </div>
            );
          })}
          {!safeData.length && <p className="empty-msg text-center py-6 text-slate-400 text-xs">No hay datos para este mes.</p>}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
          <button className="btn-primary flex items-center gap-2 text-xs">
            <ShoppingCart size={16} />
            Generar Pedido Óptimo
          </button>
        </div>
      </div>

      {/* Modal Interactivo de Entrada de Albarán / Recepción de Pedido */}
      {receptionModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" onClick={e => e.target === e.currentTarget && setReceptionModalOpen(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <PackageCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">Validar Recepción de Pedido (Entrada de Albarán)</h3>
                  <p className="text-xs text-slate-500">Confirma las cantidades de insumos que han ingresado a cocina</p>
                </div>
              </div>
              <button onClick={() => setReceptionModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Buscador de insumos */}
            <div className="py-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar ingrediente por nombre..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Lista de insumos con input de cantidad recibida */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1 my-2">
              {filteredModalItems.map(item => {
                const qtyVal = receivedQtyMap[item.id] !== undefined ? receivedQtyMap[item.id] : '';
                const stock = getStock(item);
                const reserved = getReserved(item);
                return (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 text-xs truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">
                        Stock actual: <strong className="text-slate-600">{stock} {item.unit}</strong> | Reservado: <strong className="text-indigo-600">{reserved} {item.unit}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={qtyVal}
                        onChange={e => handleQtyChange(item.id, e.target.value)}
                        className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-center focus:border-emerald-500 outline-none"
                      />
                      <span className="text-xs text-slate-400 font-medium w-8">{item.unit}</span>
                    </div>
                  </div>
                );
              })}
              {filteredModalItems.length === 0 && (
                <p className="text-center py-6 text-xs text-slate-400">No se encontraron ingredientes.</p>
              )}
            </div>

            {/* Acciones del Modal */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                {Object.values(receivedQtyMap).filter(v => Number(v) > 0).length} insumo(s) listos para actualizar
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReceptionModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmReception}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>{submitting ? 'Confirmando...' : 'Confirmar Recepción'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComprasTab;
