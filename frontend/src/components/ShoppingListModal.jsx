import React, { useMemo } from 'react';
import { X, ShoppingCart, Copy, Printer, Check } from 'lucide-react';
import { agruparInsumos } from '../utils/mathUtils';

export default function ShoppingListModal({ isOpen, onClose, plannerData, recipes, inventory = [] }) {
  
  // Calculate consolidated ingredients needed
  const consolidatedItems = useMemo(() => {
    if (!isOpen || !plannerData) return [];

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

      addMeal(menu.breakfast_recipe_id, 20, 'Desayuno'); // default 20 players for breakfast
      addMeal(menu.lunch_recipe_id, menu.lunch_players || 0, 'Almuerzo');
      addMeal(menu.lunch_side_recipe_id, menu.lunch_players || 0, 'Guarnición');
      addMeal(menu.dinner_recipe_id, menu.dinner_players || 0, 'Cena');
    });

    const needs = agruparInsumos(activeMeals);
    
    return Object.values(needs).map(item => {
      // Find current stock from local inventory
      const ing = inventory.find(x => x.id === item.ingredientId);
      const stock = Number(ing?.stock_actual !== null && ing?.stock_actual !== undefined ? ing.stock_actual : ing?.current_stock) || 0;
      const unit = (ing?.unit || 'g').toLowerCase();
      
      const needed = Number(item.quantity) || 0;
      const remaining = stock - needed;
      const toBuy = remaining < 0 ? Math.abs(remaining) : 0;

      return {
        id: item.ingredientId,
        name: item.ingName || item.name,
        needed,
        stock,
        unit,
        toBuy
      };
    });
  }, [isOpen, plannerData, recipes, inventory]);

  const handleCopyToClipboard = () => {
    const text = consolidatedItems.map(item => 
      `- ${item.name}: Requerido: ${item.needed.toFixed(1)} ${item.unit} | En Stock: ${item.stock} ${item.unit} ${item.toBuy > 0 ? `| COMPRAR: ${item.toBuy.toFixed(1)} ${item.unit}` : '(Suficiente)'}`
    ).join('\n');
    
    navigator.clipboard.writeText(text);
    alert('📋 Lista de compras copiada al portapapeles.');
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open print:bg-white print:fixed print:inset-0 print:z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box max-w-3xl max-h-[85vh] flex flex-col print:max-w-full print:h-full print:shadow-none print:p-0">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-5 flex-shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-brand" size={22} />
            <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Lista de la Compra Consolidada</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Print Header */}
        <div className="hidden print:block mb-6">
          <h2 className="text-2xl font-bold text-slate-900">ACFC Kitchen — Lista de la Compra</h2>
          <p className="text-xs text-slate-500 mt-1">Generado a partir de la planificación mensual activa.</p>
        </div>

        {/* Content body / Table */}
        <div className="flex-grow overflow-y-auto pr-2 pb-2">
          {consolidatedItems.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12 italic">No hay ingredientes requeridos para la planificación actual.</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm print:border-slate-300">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold print:bg-slate-100">
                    <th className="p-3">Ingrediente</th>
                    <th className="p-3 text-right">Cantidad Requerida</th>
                    <th className="p-3 text-right">En Stock</th>
                    <th className="p-3 text-right">Comprar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consolidatedItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="p-3 text-right text-slate-600">{item.needed.toFixed(1)} {item.unit}</td>
                      <td className="p-3 text-right text-slate-600">{item.stock.toFixed(1)} {item.unit}</td>
                      <td className="p-3 text-right">
                        {item.toBuy > 0 ? (
                          <span className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 font-extrabold text-[10px] rounded-lg">
                            {item.toBuy.toFixed(1)} {item.unit}
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-50 text-green-600 border border-green-200 font-extrabold text-[10px] rounded-lg">
                            ✓ OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer print controls */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center flex-shrink-0 print:hidden">
          <div className="flex gap-2">
            <button 
              onClick={handleCopyToClipboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Copy size={14} />
              <span>Copiar Lista</span>
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Printer size={14} />
              <span>Imprimir</span>
            </button>
          </div>
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
