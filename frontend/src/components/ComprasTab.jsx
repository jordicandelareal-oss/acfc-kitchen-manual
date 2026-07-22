import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShoppingCart, PackageCheck, History, Save, CheckCircle2, 
  Search, X, Bell, Calendar, Truck, FileText, AlertCircle, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  fetchShoppingList, 
  fetchPurchaseOrders, 
  createPurchaseOrder, 
  confirmOrderReception, 
  validarRecepcionPedido 
} from '../api';

const StatusBadge = ({ status }) => {
  let label = 'Borrador';
  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';

  if (status === 'received') {
    label = 'Recibido';
    badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (status === 'ordered' || status === 'sent') {
    label = 'Enviado';
    badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
  }

  return (
    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${badgeStyle} inline-flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'received' ? 'bg-emerald-500' : status === 'ordered' || status === 'sent' ? 'bg-blue-500' : 'bg-slate-400'}`} />
      {label}
    </span>
  );
};

const ComprasTab = ({ data, loading, month, onMonthChange, onRefresh, role, canEdit }) => {
  const [internalIngredients, setInternalIngredients] = useState([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  // History State
  const [historyOrders, setHistoryOrders] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistorySection, setShowHistorySection] = useState(false);

  // Modal State for Order Reception
  const [receptionModalOpen, setReceptionModalOpen] = useState(false);
  const [activeOrderForReception, setActiveOrderForReception] = useState(null);
  const [receptionItems, setReceptionItems] = useState([]);
  const [receivedQtyMap, setReceivedQtyMap] = useState({});
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active generated purchase order state
  const [customQuantities, setCustomQuantities] = useState({});
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Auto-fetch real-time ingredients from Supabase
  const loadIngredientsList = useCallback(async () => {
    setLoadingIngredients(true);
    try {
      const res = await fetchShoppingList();
      if (res && res.items) {
        setInternalIngredients(res.items);
      }
    } catch (e) {
      console.error('Error cargando lista de compras:', e);
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  useEffect(() => {
    loadIngredientsList();
  }, [loadIngredientsList]);

  // Load purchase orders history
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data: poList, error } = await fetchPurchaseOrders();
      if (!error && poList) {
        setHistoryOrders(poList);
      }
    } catch (e) {
      console.error('Error cargando historial de pedidos:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (showHistorySection) {
      loadHistory();
    }
  }, [showHistorySection, loadHistory]);

  const safeData = useMemo(() => {
    if (data && data.length > 0) return data;
    return internalIngredients;
  }, [data, internalIngredients]);

  const getStock = useCallback(i => Number(i?.stock_actual || 0), []);
  const getMin = useCallback(i => Number(i?.stock_minimo || 0), []);
  const getReserved = useCallback(i => Number(i?.stock_reservado || 0), []);

  // Calculate needed items for Active Order
  const activeOrderCalculatedItems = useMemo(() => {
    return safeData.map(item => {
      const stock = getStock(item);
      const min = getMin(item);
      const reserved = getReserved(item);

      // Formula: Math.max(0, Math.max(stock_reservado, stock_minimo) - stock_actual)
      const targetRequired = Math.max(reserved, min);
      const neededRaw = Math.max(0, targetRequired - stock);

      const price = Number(item.purchase_price || item.precio_compra || item.coste_neto_calculado || item.precio_por_kg || item.precio_por_u || 0);

      return {
        ...item,
        stock,
        min,
        reserved,
        neededQuantity: customQuantities[item.id] !== undefined ? customQuantities[item.id] : neededRaw,
        calculatedNeeded: neededRaw,
        unitPrice: price,
        totalCost: (customQuantities[item.id] !== undefined ? customQuantities[item.id] : neededRaw) * price
      };
    }).filter(i => Number(i.neededQuantity) > 0 || Number(i.calculatedNeeded) > 0);
  }, [safeData, getStock, getMin, getReserved, customQuantities]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return activeOrderCalculatedItems;
    const term = searchTerm.toLowerCase();
    return activeOrderCalculatedItems.filter(i => (i.name || '').toLowerCase().includes(term));
  }, [activeOrderCalculatedItems, searchTerm]);

  const activeTotalCost = useMemo(() => {
    return activeOrderCalculatedItems.reduce((acc, i) => acc + i.totalCost, 0);
  }, [activeOrderCalculatedItems]);

  // Botón de Acción 1: Guardar Orden de Compra
  const handleSavePurchaseOrder = async () => {
    const itemsToOrder = activeOrderCalculatedItems.filter(i => Number(i.neededQuantity) > 0);
    if (itemsToOrder.length === 0) {
      if (window.toast) window.toast('⚠️ No hay insumos con cantidad requerida para guardar en el pedido');
      return;
    }

    setIsSavingOrder(true);
    try {
      const totalAmount = itemsToOrder.reduce((acc, i) => acc + i.totalCost, 0);
      const orderPayload = {
        order_date: new Date().toISOString().split('T')[0],
        supplier_id: itemsToOrder[0]?.supplier_id || null,
        total_amount: totalAmount,
        status: 'ordered'
      };

      const itemsPayload = itemsToOrder.map(i => ({
        ingredient_id: i.id,
        quantity: Number(i.neededQuantity) || 0,
        unit: i.unit || 'Kg',
        price_per_unit: Number(i.unitPrice) || 0
      }));

      const { data: createdPO, error } = await createPurchaseOrder(orderPayload, itemsPayload);
      if (error) throw error;

      if (window.toast) window.toast(`✅ Orden de compra guardada con éxito (Total: €${totalAmount.toFixed(2)})`);
      
      setCustomQuantities({});
      setShowHistorySection(true);
      loadHistory();
      loadIngredientsList();
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
      if (window.toast) window.toast('❌ Error al guardar la orden de compra: ' + e.message);
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Botón de Acción 2: Validar Recepción y Actualizar Stock (Modal)
  const openReceptionModal = (order = null) => {
    if (order && order.id) {
      // Historical order
      setActiveOrderForReception(order);
      const rawItems = order.purchase_order_items || [];
      const itemsFormatted = rawItems.map(poi => ({
        id: poi.ingredient_id || poi.id,
        ingredient_id: poi.ingredient_id,
        name: poi.ingredients?.name || 'Ingrediente',
        unit: poi.unit || poi.ingredients?.unit || 'Kg',
        orderedQty: Number(poi.quantity) || 0,
        stock_actual: poi.ingredients?.stock_actual || 0,
        stock_reservado: poi.ingredients?.stock_reservado || 0
      }));
      setReceptionItems(itemsFormatted);

      const qtyMap = {};
      itemsFormatted.forEach(i => {
        qtyMap[i.ingredient_id] = i.orderedQty;
      });
      setReceivedQtyMap(qtyMap);
    } else {
      // Active calculated items
      setActiveOrderForReception(null);
      const itemsFormatted = activeOrderCalculatedItems.map(i => ({
        id: i.id,
        ingredient_id: i.id,
        name: i.name,
        unit: i.unit || 'Kg',
        orderedQty: i.neededQuantity,
        stock_actual: i.stock,
        stock_reservado: i.reserved
      }));
      setReceptionItems(itemsFormatted);

      const qtyMap = {};
      itemsFormatted.forEach(i => {
        qtyMap[i.ingredient_id] = i.orderedQty;
      });
      setReceivedQtyMap(qtyMap);
    }

    setModalSearchTerm('');
    setReceptionModalOpen(true);
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
      if (activeOrderForReception && activeOrderForReception.id) {
        const res = await confirmOrderReception(activeOrderForReception.id, itemsToUpdate);
        if (res.error) throw res.error;
      } else {
        const res = await validarRecepcionPedido(itemsToUpdate);
        if (res.error) throw res.error;
      }

      if (window.toast) window.toast(`✅ Entrada de almacén confirmada (${itemsToUpdate.length} insumos ingresados al stock actual)`);
      setReceptionModalOpen(false);
      
      loadIngredientsList();
      if (showHistorySection) {
        loadHistory();
      }
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
      if (window.toast) window.toast('❌ Error al validar la recepción de pedido: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredModalItems = useMemo(() => {
    if (!modalSearchTerm.trim()) return receptionItems;
    const term = modalSearchTerm.toLowerCase();
    return receptionItems.filter(i => (i.name || '').toLowerCase().includes(term));
  }, [receptionItems, modalSearchTerm]);

  if (loading || loadingIngredients) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-7 w-1/3 bg-slate-200 rounded-lg animate-pulse" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* CABECERA Y PANEL DE CONTROL UNIFICADO DE COMPRAS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                <ShoppingCart size={22} />
              </div>
              <span>Módulo de Compras y Pedidos</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Cálculo automático de necesidades de stock y registro directo de entradas al almacén
            </p>
          </div>

          {/* BOTONES DE ACCIÓN PRINCIPALES */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* BOTÓN DE ACCIÓN 1 */}
            <button
              onClick={handleSavePurchaseOrder}
              disabled={isSavingOrder || activeOrderCalculatedItems.length === 0}
              className="flex-1 md:flex-none px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40"
            >
              <Save size={16} />
              <span>{isSavingOrder ? 'Guardando...' : '💾 Guardar Orden de Compra'}</span>
            </button>

            {/* BOTÓN DE ACCIÓN 2 */}
            <button
              onClick={() => openReceptionModal(null)}
              className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <PackageCheck size={16} />
              <span>📦 Validar Recepción y Actualizar Stock</span>
            </button>
          </div>
        </div>

        {/* INDICADOR DE FÓRMULA Y RESUMEN */}
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
            <span>
              Fórmula de cálculo: <strong>Math.max(0, Stock Reservado - Stock Actual)</strong>
            </span>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs text-slate-500 font-semibold">
              Insumos requeridos: <strong className="text-slate-900">{activeOrderCalculatedItems.length}</strong>
            </span>
            <span className="text-xs font-extrabold text-slate-900">
              Coste Total: <strong className="text-brand text-sm">€{activeTotalCost.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* BUSCADOR DENTRO DE COMPRAS */}
        <div className="mt-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar necesidad de compra por ingrediente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            />
          </div>
        </div>

        {/* TABLA PRINCIPAL: LISTA DE COMPRAS CALCULADA */}
        <div className="mt-4 overflow-x-auto border border-slate-200/80 rounded-xl shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Ingrediente</th>
                <th className="py-3.5 px-3">Proveedor</th>
                <th className="py-3.5 px-3 text-center">Stock Actual</th>
                <th className="py-3.5 px-3 text-center">Stock Reservado</th>
                <th className="py-3.5 px-3 text-center">Cant. a Pedir</th>
                <th className="py-3.5 px-3 text-right">Precio Unid.</th>
                <th className="py-3.5 px-4 text-right">Coste Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block text-sm">{item.name}</span>
                    <span className="text-[10px] text-slate-400">Unidad: {item.unit}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-medium">
                    {item.proveedor_principal || 'Varios'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-bold">
                      {item.stock} {item.unit}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-extrabold">
                      {item.reserved} {item.unit}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <input
                      type="number"
                      step="any"
                      value={item.neededQuantity}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setCustomQuantities(prev => ({
                          ...prev,
                          [item.id]: isNaN(val) ? 0 : val
                        }));
                      }}
                      className="w-22 px-2 py-1.5 border border-slate-200 rounded-lg text-center font-bold text-slate-900 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                    />
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600 font-medium">
                    €{item.unitPrice.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-slate-900 text-sm">
                    €{item.totalCost.toFixed(2)}
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    ✅ No hay necesidades de compra calculadas en este momento. El stock actual cubre todas las reservas del menú.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN SECUNDARIA: HISTÓRICO DE PEDIDOS (PLEGABLE) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <button
          onClick={() => setShowHistorySection(prev => !prev)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <History size={18} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Histórico de Pedidos Registrados</h3>
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-600 font-bold">
              {historyOrders.length}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-brand">
            <span>{showHistorySection ? 'Ocultar historial' : 'Ver historial'}</span>
            {showHistorySection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showHistorySection && (
          <div className="pt-4 border-t border-slate-100 mt-4 space-y-3">
            {loadingHistory ? (
              <div className="space-y-2 py-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-3 text-center">Líneas</th>
                      <th className="py-3 px-4 text-right">Total (€)</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {historyOrders.map(order => {
                      const supplierName = order.suppliers?.name || 'Proveedor General / Varios';
                      const itemsCount = order.purchase_order_items?.length || 0;
                      const formattedDate = order.order_date || new Date(order.created_at).toLocaleDateString();

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {formattedDate}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {supplierName}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[11px]">
                              {itemsCount} insumos
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                            €{Number(order.total_amount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="py-3 px-4 text-right">
                            {order.status !== 'received' ? (
                              <button
                                onClick={() => openReceptionModal(order)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all"
                              >
                                <PackageCheck size={14} />
                                <span>📦 Validar Recepción</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium flex items-center justify-end gap-1">
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                Ingresado
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {historyOrders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                          📜 No hay órdenes guardadas en el historial.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL INTERACTIVO DE VALIDACIÓN Y ENTRADA AL ALMACÉN */}
      {receptionModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={e => e.target === e.currentTarget && setReceptionModalOpen(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <PackageCheck size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    Validar Recepción y Actualizar Stock (Entrada al Almacén)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Confirma las cantidades de mercancía recibidas para ingresar a stock actual y reducir reservas
                  </p>
                </div>
              </div>
              <button onClick={() => setReceptionModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Buscador dentro del modal */}
            <div className="py-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar ingrediente en el albarán..."
                  value={modalSearchTerm}
                  onChange={e => setModalSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Lista de insumos a ingresar */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1 my-2">
              {filteredModalItems.map(item => {
                const qtyVal = receivedQtyMap[item.ingredient_id] !== undefined ? receivedQtyMap[item.ingredient_id] : item.orderedQty;
                return (
                  <div key={item.ingredient_id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Pedido: <strong className="text-slate-600">{item.orderedQty} {item.unit}</strong> | Stock Actual: <strong className="text-slate-600">{item.stock_actual} {item.unit}</strong> | Reservado: <strong className="text-indigo-600">{item.stock_reservado} {item.unit}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={qtyVal}
                        onChange={e => {
                          const num = parseFloat(e.target.value);
                          setReceivedQtyMap(prev => ({
                            ...prev,
                            [item.ingredient_id]: isNaN(num) ? '' : num
                          }));
                        }}
                        className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                      <span className="text-xs text-slate-400 font-medium w-8">{item.unit}</span>
                    </div>
                  </div>
                );
              })}

              {filteredModalItems.length === 0 && (
                <p className="text-center py-6 text-xs text-slate-400">No hay insumos para recepcionar.</p>
              )}
            </div>

            {/* Acciones de confirmación */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                {Object.values(receivedQtyMap).filter(v => Number(v) > 0).length} insumo(s) listos para ingresar a stock
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
                >
                  <CheckCircle2 size={16} />
                  <span>{submitting ? 'Ingresando mercancía...' : '📦 Confirmar Entrada al Almacén'}</span>
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
