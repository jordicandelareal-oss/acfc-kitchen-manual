import React, { useMemo, useState } from 'react';
import { X, ShoppingCart, Copy, Printer, Package, ChevronDown, ChevronRight, MessageSquare, Mail } from 'lucide-react';
import { agruparInsumos } from '../utils/mathUtils';

// Colour palette for supplier sections
const SUPPLIER_COLORS = {
  'Carnicería El Cairo': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  default:              { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-600' }
};

function getSupplierColors(name) {
  if (name.toLowerCase().includes('cairo')) return SUPPLIER_COLORS['Carnicería El Cairo'];
  return SUPPLIER_COLORS.default;
}

export default function ShoppingListModal({ isOpen, onClose, plannerData, recipes, inventory = [] }) {
  const [collapsed, setCollapsed] = useState({});

  // Build listaPorProveedor from plannerData + recipe ingredients
  const listaPorProveedor = useMemo(() => {
    if (!isOpen || !plannerData) return {};

    const activeMeals = [];
    Object.entries(plannerData).forEach(([dayStr, menu]) => {
      const day = parseInt(dayStr);
      const addMeal = (recipeId, players, label) => {
        if (!recipeId || players <= 0) return;
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) return;
        activeMeals.push({
          recipeName: recipe.name,
          mealLabel: label,
          day,
          players,
          recipe_ingredients: recipe.recipe_ingredients || []
        });
      };
      addMeal(menu.breakfast_recipe_id, 20, 'Desayuno');
      addMeal(menu.lunch_recipe_id,     menu.lunch_players  || 0, 'Almuerzo');
      addMeal(menu.lunch_side_recipe_id, menu.lunch_players || 0, 'Guarnición');
      addMeal(menu.dinner_recipe_id,    menu.dinner_players || 0, 'Cena');
    });

    const needs = agruparInsumos(activeMeals);

    // Group into { 'Carnicería El Cairo': [...], 'Otros proveedores': [...] }
    const grouped = {};
    Object.values(needs).forEach(item => {
      const provName = item.isElCairo
        ? 'Carnicería El Cairo'
        : (item.supplierName && item.supplierName !== 'Sin Proveedor' ? item.supplierName : 'Sin proveedor asignado');

      // ── FASE DE DESCUENTO INDIVIDUAL DE STOCK POR BANDEJAS (El Cairo) ──
      if (item.isElCairo) {
        // Encontrar stock actual en el inventario de Supabase
        const dbIng = inventory.find(x => x.id === item.ingredientId);
        let stockRestante = Number(dbIng?.stock_actual || 0);
        let totalComprarGramos = 0;

        (item.mealBreakdown || []).forEach(meal => {
          const needed = Number(meal.needed) || 0;
          const descontado = Math.min(needed, stockRestante);
          stockRestante -= descontado;

          const comprarParaEstePlato = Math.max(0, needed - descontado);
          totalComprarGramos += comprarParaEstePlato;

          if (comprarParaEstePlato > 0) {
            console.log(`[LOG] Pedido El Cairo: Plato ${meal.label || 'Principal'} | Corte ${item.tipoCorte || 'Entera'} | Qty ${(comprarParaEstePlato / 1000).toFixed(2)} kg`);
          }
        });

        // Actualizar la cantidad consolidada final a comprar con el cálculo por bandejas
        item.quantityToBuy = totalComprarGramos;
      } else {
        // Para el resto de proveedores, restamos el stock de forma global simple
        const dbIng = inventory.find(x => x.id === item.ingredientId);
        const stockActual = Number(dbIng?.stock_actual || 0);
        item.quantityToBuy = Math.max(0, item.quantity - stockActual);
      }

      if (!grouped[provName]) grouped[provName] = [];
      grouped[provName].push(item);
    });

    // Sort: El Cairo first, then alphabetical, then "Sin proveedor" last
    const sorted = {};
    const keys = Object.keys(grouped).sort((a, b) => {
      if (a.toLowerCase().includes('cairo')) return -1;
      if (b.toLowerCase().includes('cairo')) return 1;
      if (a === 'Sin proveedor asignado') return 1;
      if (b === 'Sin proveedor asignado') return -1;
      return a.localeCompare(b);
    });
    keys.forEach(k => { sorted[k] = grouped[k]; });
    return sorted;
  }, [isOpen, plannerData, recipes, inventory]);

  const totalProviders = Object.keys(listaPorProveedor).length;
  const totalItems = Object.values(listaPorProveedor).reduce((s, arr) => s + arr.length, 0);

  const handleCopy = () => {
    const lines = [];
    Object.entries(listaPorProveedor).forEach(([prov, items]) => {
      lines.push(`\n=== ${prov.toUpperCase()} ===`);
      items.forEach(item => {
        const qty = item.isElCairo
          ? `${(item.quantityToBuy / 1000).toFixed(2)} kg`
          : `${item.quantityToBuy.toFixed(1)} ${item.unit}`;
        lines.push(`  - ${item.name}: ${qty}`);
      });
    });
    navigator.clipboard.writeText(lines.join('\n'));
    alert('📋 Lista de compras copiada al portapapeles.');
  };

  // ── MÓDULO DE COMUNICACIÓN CON PROVEEDORES ──
  const handleSendSupplier = (provName, method) => {
    const items = listaPorProveedor[provName] || [];
    if (items.length === 0) return;

    // Obtener detalles del proveedor del primer ítem (si existen)
    const supplierObj = items[0]?.supplierObj;
    const phone = supplierObj?.phone || '+34600000000';
    const email = supplierObj?.email || 'pedidos@proveedor.com';

    // Generar el cuerpo del mensaje
    const header = `📋 *PEDIDO DE COMPRA ACFC KITCHEN*\nProveedor: ${provName}\nFecha: ${new Date().toLocaleDateString()}\n\n*Productos a solicitar:*`;
    const lines = items.map(item => {
      const qty = item.isElCairo
        ? `${(item.quantityToBuy / 1000).toFixed(2)} kg`
        : `${item.quantityToBuy.toFixed(1)} ${item.unit}`;
      return `• ${item.name}: *${qty}*`;
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
              Consolidado e insumos agrupados por proveedor (Cálculo por bandejas El Cairo activo)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {totalItems} ingredientes · {totalProviders} proveedores
            </span>
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
          {totalItems === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16 italic">
              No hay ingredientes para la planificación actual.<br />
              <span className="text-xs">Genera un menú primero.</span>
            </p>
          ) : (
            Object.entries(listaPorProveedor).map(([provName, items]) => {
              const colors = getSupplierColors(provName);
              const isOpen_ = !collapsed[provName];
              const isElCairo = provName.toLowerCase().includes('cairo');
              const hasItemsToBuy = items.some(i => i.quantityToBuy > 0);

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
                            const unit = (item.unit || 'Gr').toLowerCase();
                            const isCairo = provName.toLowerCase().includes('cairo');
                            
                            const reqQty = (unit === 'g' || unit === 'gr')
                              ? `${(item.quantity / 1000).toFixed(2)} kg`
                              : `${item.quantity.toFixed(1)} ${item.unit}`;

                            const buyQty = (unit === 'g' || unit === 'gr')
                              ? `${(item.quantityToBuy / 1000).toFixed(2)} kg`
                              : `${item.quantityToBuy.toFixed(1)} ${item.unit}`;

                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-2.5 font-semibold text-slate-800">
                                  {item.ingName || item.name}
                                </td>
                                {isCairo && (
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 rounded border border-red-100">
                                      {item.tipoCorte || 'Entera'}
                                    </span>
                                  </td>
                                )}
                                <td className="px-3 py-2.5 text-right text-slate-500 font-medium">
                                  {reqQty}
                                </td>
                                <td className="px-3 py-2.5 text-right font-extrabold text-slate-900">
                                  {item.quantityToBuy > 0 ? (
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
