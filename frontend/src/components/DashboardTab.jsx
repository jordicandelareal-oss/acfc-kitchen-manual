import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, AlertTriangle, ChevronRight, 
  Utensils, Euro, Shield, Users, 
  CheckCircle, Calendar, Activity, Check, X
} from 'lucide-react';
import { fetchIngredients, fetchPlannerDataDb } from '../api';

export default function DashboardTab({ onNavigate, recipes = [], role: propsRole, setRole: propsSetRole }) {
  const [localRole, setLocalRole] = useState(() => localStorage.getItem('acfc_user_role') || 'jefe_cocina');
  const role = propsRole !== undefined ? propsRole : localRole;
  const setRole = propsSetRole !== undefined ? propsSetRole : setLocalRole;
  const [ingredients, setIngredients] = useState([]);
  const [plannerData, setPlannerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [updatingIngredientId, setUpdatingIngredientId] = useState(null);

  // Sync role to localStorage
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    localStorage.setItem('acfc_user_role', newRole);
    if (typeof window.toast === 'function') {
      window.toast(`👤 Perfil cambiado a ${newRole === 'administrador' ? 'Administrador' : 'Jefe de Cocina'}`);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [ingRes, plannerRes] = await Promise.all([
        fetchIngredients(),
        fetchPlannerDataDb()
      ]);

      if (ingRes && !ingRes.error) {
        setIngredients(ingRes.data || []);
      }

      if (plannerRes && !plannerRes.error) {
        setPlannerData(plannerRes.data || []);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const [viewDayOffset, setViewDayOffset] = useState(0); // -1: Ayer, 0: Hoy, 1: Mañana
  const [weeklyBudget, setWeeklyBudget] = useState(() => Number(localStorage.getItem('acfc_weekly_budget')) || 1250); // Presupuesto por defecto

  // Cálculo ISO de la fecha seleccionada en el carrusel de 3 días (Ayer / Hoy / Mañana)
  const selectedDayISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + viewDayOffset);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }, [viewDayOffset]);

  // Menú del día seleccionado (Ayer / Hoy / Mañana)
  const selectedDayMenu = useMemo(() => {
    return plannerData.find(m => m.date === selectedDayISO);
  }, [plannerData, selectedDayISO]);

  // ── Coste Teórico Planificado (Semanal & Mensual) ──
  const { weeklyPlannedCost, totalPlannedCostMonthly } = useMemo(() => {
    const calculateMenuCost = (menuList) => {
      let costSum = 0;
      menuList.forEach(menu => {
        const meals = [
          { recipeId: menu.breakfast_recipe_id, players: 5 },
          { recipeId: menu.lunch_recipe_id, players: menu.lunch_players || 0 },
          { recipeId: menu.lunch_side_recipe_id, players: menu.lunch_players || 0 },
          { recipeId: menu.dinner_recipe_id, players: menu.dinner_players || 0 }
        ];

        meals.forEach(meal => {
          if (!meal.recipeId || meal.players <= 0) return;
          const recipe = recipes.find(r => r.id === meal.recipeId);
          if (!recipe) return;

          let recipeCostPerPortion = 0;
          if (recipe.recipe_ingredients && recipe.recipe_ingredients.length > 0) {
            recipeCostPerPortion = recipe.recipe_ingredients.reduce((acc, ri) => {
              const ing = ri.ingredients;
              if (!ing) return acc;
              const pricePerUnit = Number(ing.calculated_net_cost_kg ?? ing.precio_por_kg ?? ing.precio_por_u ?? ing.precio_mas_bajo ?? 0);
              const qty = Number(ri.quantity_per_portion ?? ri.quantity ?? 0);
              const unit = (ri.unit || ing.unit || 'g').toLowerCase();
              let qtyInBase = qty;
              if (unit === 'g' || unit === 'gr' || unit === 'ml') {
                qtyInBase = qty / 1000;
              }
              return acc + (qtyInBase * pricePerUnit);
            }, 0);
          } else {
            recipeCostPerPortion = Number(recipe.cost_per_serving ?? recipe.coste_racion ?? 0);
          }

          costSum += recipeCostPerPortion * meal.players;
        });
      });
      return costSum;
    };

    return {
      weeklyPlannedCost: calculateMenuCost(weekMenus),
      totalPlannedCostMonthly: calculateMenuCost(plannerData)
    };
  }, [weekMenus, plannerData, recipes]);

  // Presupuesto y Gasto Estimado Semanal con Barra de Progreso
  const budgetAnalysis = useMemo(() => {
    const spent = weeklyPlannedCost || 0;
    const budget = weeklyBudget;
    const percentage = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
    const isOverBudget = spent > budget;
    return { spent, budget, percentage, isOverBudget };
  }, [weeklyPlannedCost, weeklyBudget]);

  // Statistics
  const stats = useMemo(() => {
    const totalIngredients = ingredients.length;
    
    const criticalItems = ingredients.filter(i => {
      const stock = i.stock_actual ?? i.current_stock ?? 0;
      const reserved = i.stock_reservado ?? 0;
      const min = i.stock_minimo ?? i.min_stock ?? 0;
      return (stock - reserved) <= min;
    });

    const lowStockAlerts = criticalItems.length;

    const warehouseValue = ingredients.reduce((sum, item) => {
      const stock = Number(item.stock_actual ?? item.current_stock ?? 0);
      const cost = Number(item.calculated_net_cost_kg ?? item.precio_mas_bajo ?? item.purchase_price ?? 0);
      return sum + (stock * cost);
    }, 0);

    return {
      totalIngredients,
      lowStockAlerts,
      warehouseValue,
      criticalItems: criticalItems.slice(0, 5)
    };
  }, [ingredients]);

  // Special diets sum for selected week
  const diets = useMemo(() => {
    let halal = 0;
    let kosher = 0;
    let vegan = 0;

    weekMenus.forEach(m => {
      halal += (Number(m.breakfast_halal) || 0) + (Number(m.lunch_halal) || 0) + (Number(m.dinner_halal) || 0);
      kosher += (Number(m.breakfast_kosher) || 0) + (Number(m.lunch_kosher) || 0) + (Number(m.dinner_kosher) || 0);
      vegan += (Number(m.breakfast_vegan) || 0) + (Number(m.lunch_vegan) || 0) + (Number(m.dinner_vegan) || 0);
    });

    return { halal, kosher, vegan };
  }, [weekMenus]);

  // Carnicería El Cairo cuts consolidator
  const cairoCuts = useMemo(() => {
    const activeMeals = [];
    weekMenus.forEach(menu => {
      const parts = menu.date.split('-');
      const day = parseInt(parts[2]);
      const meals = [
        { id: menu.breakfast_recipe_id, players: 5, label: 'Desayuno', day },
        { id: menu.lunch_recipe_id, players: menu.lunch_players || 0, label: 'Almuerzo', day },
        { id: menu.dinner_recipe_id, players: menu.dinner_players || 0, label: 'Cena', day }
      ];
      meals.forEach(meal => {
        if (!meal.id || meal.players <= 0) return;
        const recipe = recipes.find(r => r.id === meal.id);
        if (!recipe) return;
        activeMeals.push({
          recipeName: recipe.name,
          mealLabel: meal.label,
          day: meal.day,
          players: meal.players,
          recipe_ingredients: recipe.recipe_ingredients || []
        });
      });
    });

    const needs = {};
    activeMeals.forEach(meal => {
      const servings = meal.players || 1;
      meal.recipe_ingredients.forEach(ri => {
        const ing = ri.ingredients;
        if (!ing) return;
        const key = ing.id;
        const qtyPerServing = Number(ri.quantity_per_portion ?? ri.quantity ?? 0);
        const totalQty = qtyPerServing * servings;

        if (!needs[key]) {
          needs[key] = {
            ingredientId: ing.id,
            name: ing.name,
            quantity: 0,
            ingName: ing.name
          };
        }
        needs[key].quantity += totalQty;
      });
    });

    const cuts = {};
    Object.values(needs).forEach(item => {
      const ing = ingredients.find(x => x.id === item.ingredientId);
      const providerName = ing?.provider_name || ing?.supplier || ing?.proveedor_principal || '';
      
      if (providerName.toLowerCase().includes('el cairo')) {
        const ingName = item.ingName || item.name || '';
        let cut = 'Otros';
        if (ingName.toLowerCase().includes('tacos')) {
          cut = 'Tacos';
        } else if (ingName.toLowerCase().includes('entero') || ingName.toLowerCase().includes('entera')) {
          cut = 'Entero/a';
        } else if (ingName.toLowerCase().includes('filet') || ingName.toLowerCase().includes('filete')) {
          cut = 'Filetes';
        } else if (ingName.toLowerCase().includes('picad')) {
          cut = 'Picada';
        } else {
          const match = ingName.match(/\(([^)]+)\)/);
          if (match) {
            cut = match[1];
          }
        }
        
        const qty = Number(item.quantity) || 0;
        const unit = (ing?.unit || 'g').toLowerCase();
        let qtyInKg = qty;
        if (unit === 'g' || unit === 'gr') {
          qtyInKg = qty / 1000;
        }
        
        cuts[cut] = (cuts[cut] || 0) + qtyInKg;
      }
    });

    return Object.entries(cuts);
  }, [weekMenus, recipes, ingredients]);

  // ── Lógica de Mise en Place dinámico para Asistente (calculada a partir del menú de HOY) ──
  const todayMiseEnPlace = useMemo(() => {
    const targetMenu = plannerData.find(m => m.date === todayISO);
    if (!targetMenu) return [];
    
    const itemsMap = new Map();
    const processRecipe = (recipeId, playersCount) => {
      if (!recipeId || playersCount <= 0) return;
      const recipe = recipes.find(r => r.id === recipeId);
      if (!recipe || !recipe.recipe_ingredients) return;

      recipe.recipe_ingredients.forEach(ri => {
        const ingName = ri.ingredients?.name || ri.name || 'Ingrediente';
        const unit = ri.unit || ri.ingredients?.unit || 'g';
        const qtyPerServing = Number(ri.quantity_per_portion ?? ri.quantity ?? 0);
        const totalQty = qtyPerServing * playersCount;

        if (itemsMap.has(ingName)) {
          const existing = itemsMap.get(ingName);
          existing.qty += totalQty;
        } else {
          itemsMap.set(ingName, { name: ingName, qty: totalQty, unit });
        }
      });
    };

    processRecipe(targetMenu.lunch_recipe_id, targetMenu.lunch_players || 0);
    processRecipe(targetMenu.lunch_side_recipe_id, targetMenu.lunch_players || 0);
    processRecipe(targetMenu.dinner_recipe_id, targetMenu.dinner_players || 0);

    return Array.from(itemsMap.values());
  }, [plannerData, recipes, todayISO]);

  // Estado del checklist de Mise en Place guardado en localStorage por fecha ISO
  const storageKey = `acfc_mise_${todayISO}`;
  const [checkedItems, setCheckedItems] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleCheckItem = (name) => {
    const updated = { ...checkedItems, [name]: !checkedItems[name] };
    setCheckedItems(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error('Error al guardar checklist de mise en place:', e);
    }
  };

  // Renderizado exclusivo para Asistente de Cocina (Mise en Place Ultra-Simplificado)
  if (role === 'assistant') {
    const todayMenuCurrent = plannerData.find(m => m.date === todayISO);
    return (
      <div className="space-y-6">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Outfit' }}>
              Mise en Place & Producción de Hoy
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Vista simplificada para Asistente de Cocina · {todayISO}</p>
          </div>
          <span className="px-3 py-1.5 bg-brand/10 text-brand text-xs font-bold rounded-xl flex items-center gap-1">
            <Users size={14} /> Modo Producción (Asistente)
          </span>
        </div>

        {/* Menú y Comensales de Hoy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 bg-amber-50/80 border border-amber-200 rounded-3xl shadow-sm">
            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>☀️ Almuerzo ({todayMenuCurrent?.lunch_players || 0} Jugadores)</span>
            </h3>
            <p className="text-lg font-extrabold text-slate-900">{todayMenuCurrent?.lunch_recipe?.name || 'No planificado'}</p>
            {todayMenuCurrent?.lunch_side_recipe && (
              <div className="mt-2 p-2 bg-emerald-100/70 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-950">
                🥗 Guarnición: {todayMenuCurrent.lunch_side_recipe.name}
              </div>
            )}
          </div>

          <div className="p-6 bg-indigo-50/80 border border-indigo-200 rounded-3xl shadow-sm">
            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>🌙 Cena ({todayMenuCurrent?.dinner_players || 0} Jugadores)</span>
            </h3>
            <p className="text-lg font-extrabold text-slate-900">{todayMenuCurrent?.dinner_recipe?.name || 'No planificado'}</p>
          </div>
        </div>

        {/* Checklist de Mise en Place */}
        <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-1" style={{ fontFamily: 'Outfit' }}>
            📋 Pre-elaboraciones e Ingredientes Reservados para Hoy
          </h3>
          <p className="text-xs text-slate-400 mb-4">Ingredientes calculados por ración en el planificador. Marca las tareas a medida que las prepares.</p>

          {todayMiseEnPlace.length === 0 ? (
            <div className="text-slate-400 text-xs italic text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No hay ingredientes reservados o platos planificados para el día de hoy.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {todayMiseEnPlace.map(item => {
                const isChecked = !!checkedItems[item.name];
                return (
                  <div 
                    key={item.name}
                    onClick={() => toggleCheckItem(item.name)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 line-through opacity-75' : 'bg-slate-50 border-slate-200 hover:border-brand text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs border ${
                        isChecked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-300'
                      }`}>
                        {isChecked ? '✓' : ''}
                      </div>
                      <span className="text-sm font-bold">{item.name}</span>
                    </div>
                    <span className="text-xs font-extrabold px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-xs">
                      {item.qty >= 1000 ? `${(item.qty / 1000).toFixed(1)} kg` : `${item.qty.toFixed(0)} ${item.unit}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleOrderNow = async (item) => {
    setUpdatingIngredientId(item.id);
    if (typeof window.toast === 'function') {
      window.toast(`🛒 Iniciando pedido rápido para ${item.name}...`);
    }
    setTimeout(() => {
      setUpdatingIngredientId(null);
      if (typeof window.toast === 'function') {
        window.toast(`✅ Pedido para ${item.name} registrado con éxito.`);
      }
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Outfit' }}>
            Panel de Control Gastronómico
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">ACFC Kitchen Principal · Samir Cairo</p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-indigo-50 border border-indigo-200/80 text-brand text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs">
            <Shield size={14} />
            <span>Perfil: {role === 'admin' ? 'Administrador (Admin)' : role === 'chef' ? 'Jefe de Cocina (Chef)' : 'Asistente de Cocina (Assistant)'}</span>
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingredients */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow transition-all relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Package size={22} />
            </div>
            <span className="badge badge-indigo">+{stats.totalIngredients}</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800 mt-4" style={{ fontFamily: 'Outfit' }}>
            {loading ? '—' : stats.totalIngredients}
          </p>
          <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">Ingredientes</p>
        </div>

        {/* Low Stock Alerts */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow transition-all relative overflow-hidden cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors">
              <AlertTriangle size={22} />
            </div>
            <span className={`badge ${stats.lowStockAlerts > 0 ? 'badge-danger pulse-red' : 'badge-ok'}`}>
              {stats.lowStockAlerts > 0 ? 'CRÍTICO' : 'OK'}
            </span>
          </div>
          <p className={`text-2xl font-extrabold mt-4 ${stats.lowStockAlerts > 0 ? 'text-red-600' : 'text-slate-800'}`} style={{ fontFamily: 'Outfit' }}>
            {loading ? '—' : stats.lowStockAlerts}
          </p>
          <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">Stock Crítico</p>
        </div>

        {/* Total Recipes */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow transition-all relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Utensils size={22} />
            </div>
            <span className="badge badge-ok">Catálogo</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800 mt-4" style={{ fontFamily: 'Outfit' }}>
            {loading ? '—' : recipes.length}
          </p>
          <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">Total Recetas</p>
        </div>

        {/* KPI: Coste Teórico Planificado */}
        <div className={`p-5 rounded-2xl border shadow-sm transition-all relative overflow-hidden ${role === 'admin' ? 'bg-white border-slate-200/60' : 'bg-slate-50/50 border-slate-200/40 opacity-75'}`}>
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-indigo-50 text-brand rounded-xl">
              <Euro size={22} />
            </div>
            <span className="badge badge-indigo">
              Planificado
            </span>
          </div>
          
          {role === 'admin' ? (
            <>
              <p className="text-2xl font-extrabold text-slate-800 mt-4" style={{ fontFamily: 'Outfit' }}>
                {loading ? '—' : weeklyPlannedCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Total Mensual Planificado:</span>
                <span className="text-xs font-bold text-brand">
                  {totalPlannedCostMonthly.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">Calculado según raciones y escandallos activos.</p>
            </>
          ) : (
            <div className="mt-4 py-2">
              <p className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Shield size={12} />
                <span>Restringido a Admin</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">Los costes financieros están reservados al perfil Administrador.</p>
            </div>
          )}
          <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">Coste Teórico Semanal</p>
        </div>
      </div>

      {/* Week Selector */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Calendar size={16} className="text-brand" />
          <span>Planificación Semanal de Operaciones</span>
        </div>
        <select 
          value={selectedWeek} 
          onChange={e => setSelectedWeek(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none cursor-pointer focus:border-brand"
        >
          {weeksList.map(w => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </div>

      {/* Main Operations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Menu Carousel Widget (AYER | HOY | MAÑANA) */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <Calendar size={18} className="text-brand" />
                <span>Vista de Menú</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400 font-semibold">{selectedDayISO}</span>
            </div>

            {/* Selector de 3 Días */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl mb-4 text-[11px] font-bold text-center">
              <button 
                onClick={() => setViewDayOffset(-1)}
                className={`py-1.5 rounded-lg transition-all ${viewDayOffset === -1 ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                AYER
              </button>
              <button 
                onClick={() => setViewDayOffset(0)}
                className={`py-1.5 rounded-lg transition-all ${viewDayOffset === 0 ? 'bg-brand text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                HOY
              </button>
              <button 
                onClick={() => setViewDayOffset(1)}
                className={`py-1.5 rounded-lg transition-all ${viewDayOffset === 1 ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                MAÑANA
              </button>
            </div>
            
            {loading ? (
              <div className="text-center p-6 text-slate-400 text-xs italic">Cargando menú...</div>
            ) : !selectedDayMenu || (!selectedDayMenu.lunch_recipe_id && !selectedDayMenu.dinner_recipe_id) ? (
              <div className="text-slate-400 text-xs italic text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No hay platos planificados para {viewDayOffset === -1 ? 'ayer' : viewDayOffset === 0 ? 'hoy' : 'mañana'}.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayMenu.breakfast_recipe && (
                  <div className="flex items-center justify-between text-xs p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                    <span className="text-slate-500 font-medium flex items-center gap-1">🍳 Desayuno:</span>
                    <span className="font-bold text-slate-800 truncate max-w-[150px]">{selectedDayMenu.breakfast_recipe.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs p-2 bg-amber-50/60 border border-amber-100 rounded-xl">
                  <span className="text-amber-800 font-medium flex items-center gap-1">☀️ Almuerzo:</span>
                  <span className="font-bold text-amber-950 truncate max-w-[150px]">{selectedDayMenu.lunch_recipe?.name || 'No planificado'}</span>
                </div>
                {selectedDayMenu.lunch_side_recipe && (
                  <div className="flex items-center justify-between text-xs p-2 pl-4 bg-emerald-50/60 rounded-xl border border-emerald-200/60">
                    <span className="text-emerald-700 font-medium flex items-center gap-1">🥗 Guarnición:</span>
                    <span className="font-bold text-emerald-950 truncate max-w-[150px]">{selectedDayMenu.lunch_side_recipe.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs p-2 bg-indigo-50/60 border border-indigo-100 rounded-xl">
                  <span className="text-indigo-800 font-medium flex items-center gap-1">🌙 Cena:</span>
                  <span className="font-bold text-indigo-950 truncate max-w-[150px]">{selectedDayMenu.dinner_recipe?.name || 'No planificado'}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1"><Users size={12} /> Comensales:</span>
                  <span className="font-bold text-slate-800">
                    {(selectedDayMenu.lunch_players || 0) + (selectedDayMenu.dinner_players || 0)} jugadores
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta Control Presupuestario (€) */}
          {(role === 'chef' || role === 'admin') && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-bold text-slate-700">Presupuesto Semanal:</span>
                <span className="font-extrabold text-slate-900">{budgetAnalysis.spent.toFixed(0)}€ / {budgetAnalysis.budget}€</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${budgetAnalysis.isOverBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${budgetAnalysis.percentage}%` }}
                />
              </div>
              <p className={`text-[10px] font-bold mt-1 text-right ${budgetAnalysis.isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                {budgetAnalysis.isOverBudget ? '⚠️ Excede presupuesto semanal' : `🟢 Dentro del límite (${budgetAnalysis.percentage}%)`}
              </p>
            </div>
          )}
        </div>
        </div>

        {/* Special Diets Widget */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
              <Activity size={18} className="text-brand" />
              <span>Dietas Especiales</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">Resumen de requerimientos semanales</p>
            
            {loading ? (
              <div className="text-center p-6 text-slate-400 text-xs italic">Cargando dietas...</div>
            ) : weekMenus.length === 0 ? (
              <div className="text-slate-400 text-xs italic text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Sin menús planificados para esta semana.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider">🟢 Halal</span>
                  <span className="text-base font-extrabold text-emerald-800">{diets.halal} raciones</span>
                </div>
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs text-blue-700 font-bold uppercase tracking-wider">🔵 Kosher</span>
                  <span className="text-base font-extrabold text-blue-800">{diets.kosher} raciones</span>
                </div>
                <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs text-orange-700 font-bold uppercase tracking-wider">🌿 Vegano</span>
                  <span className="text-base font-extrabold text-orange-800">{diets.vegan} raciones</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Carnicería El Cairo Widget */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
              <CheckCircle size={18} className="text-brand" />
              <span>Carnicería El Cairo</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">Cortes y demandas de carne para la semana</p>
            
            {loading ? (
              <div className="text-center p-6 text-slate-400 text-xs italic">Cargando cortes...</div>
            ) : cairoCuts.length === 0 ? (
              <div className="text-slate-400 text-xs italic text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No se requieren cortes de carne para esta semana.
              </div>
            ) : (
              <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                {cairoCuts.map(([cut, val]) => (
                  <div key={cut} className="flex justify-between items-center text-xs p-2 bg-slate-50/60 border border-slate-100 rounded-xl">
                    <span className="text-slate-600 font-semibold">{cut}:</span>
                    <span className="font-bold text-slate-800">{val.toFixed(2)} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      {/* Critical Alerts List Section */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
          <AlertTriangle size={18} className="text-red-500" />
          <span>Alertas de Stock en Almacén</span>
        </h3>
        <p className="text-[11px] text-slate-400 mb-4">Ingredientes agotados o por debajo del stock mínimo</p>

        {loading ? (
          <div className="text-center p-6 text-slate-400 text-xs italic">Cargando alertas...</div>
        ) : stats.criticalItems.length === 0 ? (
          <div className="flex items-center justify-center p-6 bg-emerald-50/30 border border-dashed border-emerald-200 rounded-2xl text-emerald-700 text-xs font-semibold">
            🟢 Todo en orden. No hay alertas de stock en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.criticalItems.map(i => {
              const stock = i.stock_actual ?? i.current_stock ?? 0;
              const reserved = i.stock_reservado ?? 0;
              const min = i.stock_minimo ?? i.min_stock ?? 0;
              const disp = stock - reserved;
              
              return (
                <div key={i.id} className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-red-50/40 border border-red-100 shadow-sm">
                  <div className="flex-grow min-w-0">
                    <p className="text-xs font-bold text-red-800 truncate">{i.name}</p>
                    <p className="text-[10px] text-red-600 mt-1 font-semibold">
                      Disponible: {disp.toFixed(0)} {i.unit || 'g'} (Mín: {min.toFixed(0)} {i.unit || 'g'})
                    </p>
                    {reserved > 0 && (
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Stock físico: {stock.toFixed(0)} | Reservado: {reserved.toFixed(0)}
                      </p>
                    )}
                  </div>
                  <button 
                    disabled={updatingIngredientId === i.id}
                    onClick={() => handleOrderNow(i)}
                    className="text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-100/50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap self-center disabled:opacity-50"
                  >
                    {updatingIngredientId === i.id ? 'Pediente...' : 'Pedir ahora'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Access Actions */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
        <h3 className="section-title mb-3" style={{ fontFamily: 'Outfit' }}>Accesos Rápidos a Módulos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Calendar size={16} />,   label: 'Ver Menú Semanal',    tab: 'planner' },
            { icon: <Package size={16} />,    label: 'Control de Insumos',  tab: 'inventory' },
            { icon: <Utensils size={16} />,   label: 'Recetas & Escandallos', tab: 'recipes' },
          ].map(({ icon, label, tab }, idx) => (
            <button 
              key={idx} 
              className="flex items-center justify-between p-3.5 border border-slate-200/80 rounded-xl hover:border-brand hover:bg-brand-muted/10 text-xs font-semibold text-slate-700 hover:text-brand transition-all text-left group"
              onClick={() => onNavigate(tab)}
            >
              <span className="flex items-center gap-2">
                <span className="text-slate-400 group-hover:text-brand transition-colors">{icon}</span>
                <span>{label}</span>
              </span>
              <ChevronRight size={14} className="text-slate-400 group-hover:text-brand transition-colors transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
