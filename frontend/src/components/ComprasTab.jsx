import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShoppingCart, PackageCheck, History, Save, CheckCircle2, 
  Search, X, Bell, Calendar, Truck, FileText, AlertCircle, RefreshCw, 
  MessageCircle, Mail, ChevronDown, ChevronUp, Store
} from 'lucide-react';
import { 
  fetchShoppingList, 
  fetchPurchaseOrders, 
  createPurchaseOrder, 
  confirmOrderReception, 
  validarRecepcionPedido 
} from '../api';
import { calcularCosteLineaIngrediente, formatSupplierMessage } from '../utils/mathUtils';

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

  // Calculate needed items for Active Order with precise net cost formula
  const activeOrderCalculatedItems = useMemo(() => {
    return safeData.map(item => {
      const stock = getStock(item);
      const min = getMin(item);
      const reserved = getReserved(item);

      // Formula: Math.max(0, Math.max(stock_reservado, stock_minimo) - stock_actual)
      const targetRequired = Math.max(reserved, min);
      const neededRaw = Math.max(0, targetRequired - stock);

      const neededQuantity = customQuantities[item.id] !== undefined ? customQuantities[item.id] : neededRaw;
      
      // Calculate total cost using exact net cost formula from mathUtils
      const totalCost = calcularCosteLineaIngrediente(item, neededQuantity);
      
      const unit = (item.unit || '').toLowerCase();
      const isKgLt = item.output_scenario === 'KG_LT' || ['gr', 'g', 'kg', 'ml', 'l'].includes(unit);
      
      let unitPrice = 0;
      if (isKgLt) {
        unitPrice = Number(item.calculated_net_cost_kg || item.coste_neto_calculado || item.purchase_price || item.precio_por_kg || 0);
        if (unitPrice <= 0 && neededQuantity > 0 && totalCost > 0) {
          unitPrice = totalCost / (neededQuantity / 1000);
        }
      } else {
        unitPrice = Number(item.precio_por_u || item.purchase_price || item.precio_mas_bajo || 0);
      }

      const supplierObj = item.suppliers || null;
      const supplierName = supplierObj?.name || item.proveedor_principal || 'Otros / Sin Proveedor';
      const supplierId = supplierObj?.id || item.supplier_id || 'no-supplier';
      const isElCairo = (supplierId === 'd257d90b-ad0b-4f84-97a0-fee73612953c') || (supplierName.toLowerCase().includes('cairo'));

      return {
        ...item,
        stock,
        min,
        reserved,
        neededQuantity,
        calculatedNeeded: neededRaw,
        unitPrice,
        totalCost,
        supplierId,
        supplierName,
        supplierObj,
        isElCairo
      };
    }).filter(i => Number(i.neededQuantity) > 0 || Number(i.calculatedNeeded) > 0);
  }, [safeData, getStock, getMin, getReserved, customQuantities]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return activeOrderCalculatedItems;
    const term = searchTerm.toLowerCase();
    return activeOrderCalculatedItems.filter(i => 
      (i.name || '').toLowerCase().includes(term) || 
      (i.supplierName || '').toLowerCase().includes(term)
    );
  }, [activeOrderCalculatedItems, searchTerm]);

  // Group calculated purchase items by Supplier
  const supplierGroups = useMemo(() => {
    const groupsMap = {};

    filteredItems.forEach(item => {
      const sKey = item.supplierId || 'no-supplier';
      if (!groupsMap[sKey]) {
        groupsMap[sKey] = {
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          supplierPhone: item.supplierObj?.phone || null,
          supplierEmail: item.supplierObj?.email || null,
          isElCairo: item.isElCairo,
          items: [],
          totalGroupCost: 0
        };
      }
      groupsMap[sKey].items.push(item);
      groupsMap[sKey].totalGroupCost += item.totalCost;
    });

    return Object.values(groupsMap);
  }, [filteredItems]);

  const activeTotalCost = useMemo(() => {
    return activeOrderCalculatedItems.reduce((acc, i) => acc + i.totalCost, 0);
  }, [activeOrderCalculatedItems]);

  // Guardar Orden de Compra para un grupo específico de proveedor o para todos
  const handleSavePurchaseOrderForSupplier = async (supplierGroup = null) => {
    const itemsToOrder = supplierGroup 
      ? supplierGroup.items.filter(i => Number(i.neededQuantity) > 0)
      : activeOrderCalculatedItems.filter(i => Number(i.neededQuantity) > 0);

    if (itemsToOrder.length === 0) {
      if (window.toast) window.toast('⚠️ No hay insumos con cantidad requerida para guardar');
      return;
    }

    setIsSavingOrder(true);
    try {
      const totalAmount = itemsToOrder.reduce((acc, i) => acc + i.totalCost, 0);
      const orderPayload = {
        order_date: new Date().toISOString().split('T')[0],
        supplier_id: supplierGroup && supplierGroup.supplierId !== 'no-supplier' ? supplierGroup.supplierId : itemsToOrder[0]?.supplierId || null,
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

      const groupName = supplierGroup ? supplierGroup.supplierName : 'General';
      if (window.toast) window.toast(`✅ Orden de compra guardada para ${groupName} (Total: €${totalAmount.toFixed(2)})`);
      
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

  // Enviar por WhatsApp
  const handleSendWhatsApp = (supplierGroup) => {
    if (!supplierGroup.supplierPhone) {
      if (window.toast) window.toast('⚠️ Este proveedor no tiene número de teléfono de WhatsApp configurado.');
      return;
    }

    const cleanPhone = supplierGroup.supplierPhone.replace(/[^0-9]/g, '');
    const msg = formatSupplierMessage(supplierGroup.supplierName, supplierGroup.items, supplierGroup.isElCairo);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Enviar por Email
  const handleSendEmail = (supplierGroup) => {
    if (!supplierGroup.supplierEmail) {
      if (window.toast) window.toast('⚠️ Este proveedor no tiene correo electrónico configurado.');
      return;
    }

    const msg = formatSupplierMessage(supplierGroup.supplierName, supplierGroup.items, supplierGroup.isElCairo);
    const mailtoUrl = `mailto:${supplierGroup.supplierEmail}?subject=${encodeURIComponent('Pedido ACFC Kitchen - ' + supplierGroup.supplierName)}&body=${encodeURIComponent(msg)}`;
    window.open(mailtoUrl, '_blank');
  };

  // Modal de Recepción (Albarán)
  const openReceptionModal = (order = null) => {
    if (order && order.id) {
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

      if (window.toast) window.toast(`✅ Entrada al almacén confirmada (${itemsToUpdate.length} insumos sumados a stock actual)`);
      setReceptionModalOpen(false);
      
      loadIngredientsList();
      if (showHistorySection) {
        loadHistory();
      }
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
      if (window.toast) window.toast('❌ Error al validar recepción de pedido: ' + e.message);
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
    <div className="space-y-6">
      {/* CABECERA Y PANEL PRINCIPAL DE COMPRAS */}
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
              Cálculo automático agrupado por proveedores, envío de albaranes y recepción al almacén
            </p>
          </div>

          {/* ACCIONES GLOBALES */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => handleSavePurchaseOrderForSupplier(null)}
              disabled={isSavingOrder || activeOrderCalculatedItems.length === 0}
              className="flex-1 md:flex-none px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40"
            >
              <Save size={16} />
              <span>{isSavingOrder ? 'Guardando...' : '💾 Registrar Todo el Pedido'}</span>
            </button>

            <button
              onClick={() => openReceptionModal(null)}
              className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <PackageCheck size={16} />
              <span>📦 Validar Recepción y Actualizar Stock</span>
            </button>
          </div>
        </div>

        {/* BANNER INFORMATIVO */}
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
            <span>
              Fórmula de coste neto: <strong>(Gramos / 1000) * Coste Neto Real KG (con merma)</strong>
            </span>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs text-slate-500 font-semibold">
              Proveedores activos: <strong className="text-slate-900">{supplierGroups.length}</strong>
            </span>
            <span className="text-xs font-extrabold text-slate-900">
              Total Global: <strong className="text-brand text-sm">€{activeTotalCost.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* FILTRADO RÁPIDO */}
        <div className="mt-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ingrediente o proveedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            />
          </div>
        </div>
      </div>

      {/* BLOQUES AGRUPADOS POR PROVEEDOR */}
      <div className="space-y-5">
        {supplierGroups.map(group => {
          const hasPhone = !!group.supplierPhone;
          const hasEmail = !!group.supplierEmail;

          return (
            <div key={group.supplierId} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              {/* CABECERA DEL PROVEEDOR */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <span>{group.supplierName}</span>
                      {group.isElCairo && (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                          🥩 Regla Carnicería El Cairo (Desglose)
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {group.items.length} insumo(s) a pedir · Total Proveedor: <strong className="text-brand font-bold">€{group.totalGroupCost.toFixed(2)}</strong>
                    </p>
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN POR PROVEEDOR (WHATSAPP, EMAIL, REGISTRAR) */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* WhatsApp Button */}
                  <button
                    onClick={() => handleSendWhatsApp(group)}
                    disabled={!hasPhone}
                    title={hasPhone ? `Enviar pedido por WhatsApp a ${group.supplierPhone}` : 'Sin teléfono configurado'}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <MessageCircle size={15} />
                    <span>WhatsApp</span>
                  </button>

                  {/* Email Button */}
                  <button
                    onClick={() => handleSendEmail(group)}
                    disabled={!hasEmail}
                    title={hasEmail ? `Enviar pedido por Email a ${group.supplierEmail}` : 'Sin correo configurado'}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Mail size={15} />
                    <span>Correo</span>
                  </button>

                  {/* Registrar Orden de Compra individual */}
                  <button
                    onClick={() => handleSavePurchaseOrderForSupplier(group)}
                    disabled={isSavingOrder}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-40"
                  >
                    <Save size={15} />
                    <span>💾 Registrar Orden</span>
                  </button>
                </div>
              </div>

              {/* TABLA DE INSUMOS DE ESTE PROVEEDOR */}
              <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Ingrediente</th>
                      <th className="py-3 px-3 text-center">Stock Actual</th>
                      <th className="py-3 px-3 text-center">Stock Reservado</th>
                      <th className="py-3 px-3 text-center">Cant. a Pedir</th>
                      <th className="py-3 px-3 text-right">Coste Neto/Kg o U</th>
                      <th className="py-3 px-4 text-right">Coste Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {group.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block text-xs">{item.name}</span>
                          <span className="text-[10px] text-slate-400">Unidad: {item.unit}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px]">
                            {item.stock} {item.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-extrabold text-[11px]">
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
                            className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold text-slate-900 focus:border-brand outline-none text-xs"
                          />
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 font-medium">
                          €{item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900 text-xs">
                          €{item.totalCost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {supplierGroups.length === 0 && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-xs shadow-sm">
            ✅ No hay necesidades de compra calculadas. El stock actual cubre todas las reservas del menú planificado.
          </div>
        )}
      </div>

      {/* SECCIÓN PLEGABLE DE HISTÓRICO DE PEDIDOS */}
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
