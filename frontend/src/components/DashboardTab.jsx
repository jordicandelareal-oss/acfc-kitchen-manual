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

  // Today's date calculations
  const todayISO = useMemo(() => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }, []);

  // Find today's menu
  const todayMenu = useMemo(() => {
    return plannerData.find(m => m.date === todayISO);
  }, [plannerData, todayISO]);

  // Weeks list for selector
  const weeksList = useMemo(() => {
    return [
      { value: '2026-07-06', label: 'Semana 1 (Del 06/07 al 12/07)' },
      { value: '2026-07-13', label: 'Semana 2 (Del 13/07 al 19/07)' },
      { value: '2026-07-20', label: 'Semana 3 (Del 20/07 al 26/07)' },
      { value: '2026-07-27', label: 'Semana 4 (Del 27/07 al 02/08)' },
      { value: '2026-08-03', label: 'Semana 5 (Del 03/08 al 09/08)' }
    ];
  }, []);

  // Set default selected week to current or closest
  useEffect(() => {
    if (!selectedWeek && weeksList.length > 0) {
      const todayTime = new Date(todayISO).getTime();
      const currentWeek = weeksList.find(w => {
        const start = new Date(w.value).getTime();
        const end = start + 7 * 24 * 60 * 60 * 1000;
        return todayTime >= start && todayTime < end;
      });
      setSelectedWeek(currentWeek ? currentWeek.value : weeksList[1].value);
    }
  }, [weeksList, selectedWeek, todayISO]);

  // Filter planner data for the selected week
  const weekMenus = useMemo(() => {
    if (!selectedWeek) return [];
    const start = new Date(selectedWeek);
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      weekDates.push([
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
      ].join('-'));
    }
    return plannerData.filter(m => m.date && weekDates.includes(m.date));
  }, [plannerData, selectedWeek]);

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
        
        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200/50">
          <button 
            onClick={() => handleRoleChange('jefe_cocina')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${role === 'jefe_cocina' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Utensils size={13} />
            <span>Jefe de Cocina</span>
          </button>
          <button 
            onClick={() => handleRoleChange('administrador')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${role === 'administrador' ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Shield size={13} />
            <span>Administrador</span>
          </button>
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
        <div className={`p-5 rounded-2xl border shadow-sm transition-all relative overflow-hidden ${role === 'administrador' ? 'bg-white border-slate-200/60' : 'bg-slate-50/50 border-slate-200/40 opacity-75'}`}>
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-indigo-50 text-brand rounded-xl">
              <Euro size={22} />
            </div>
            <span className="badge badge-indigo">
              Planificado
            </span>
          </div>
          
          {role === 'administrador' ? (
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
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">Cambia el perfil a Admin para ver costes financieros.</p>
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
        
        {/* Today's Menu Widget */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
              <Calendar size={18} className="text-brand" />
              <span>Menú de Hoy</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">Platos planificados para la fecha actual</p>
            
            {loading ? (
              <div className="text-center p-6 text-slate-400 text-xs italic">Cargando menú...</div>
            ) : !todayMenu || (!todayMenu.lunch_recipe_id && !todayMenu.dinner_recipe_id) ? (
              <div className="text-slate-400 text-xs italic text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No hay platos planificados para hoy en el calendario.
              </div>
            ) : (
              <div className="space-y-3.5">
                {todayMenu.breakfast_recipe && (
                  <div className="flex items-center justify-between text-xs p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                    <span className="text-slate-500 font-medium flex items-center gap-1">🍳 Desayuno:</span>
                    <span className="font-bold text-slate-800 truncate max-w-[150px]">{todayMenu.breakfast_recipe.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1">🌞 Almuerzo:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{todayMenu.lunch_recipe?.name || 'No planificado'}</span>
                </div>
                {todayMenu.lunch_side_recipe && (
                  <div className="flex items-center justify-between text-xs p-2 pl-4 bg-emerald-50/30 rounded-xl border border-emerald-100/50">
                    <span className="text-emerald-600 font-medium flex items-center gap-1">🥗 Guarnición:</span>
                    <span className="font-bold text-emerald-800 truncate max-w-[150px]">{todayMenu.lunch_side_recipe.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1">🌙 Cena:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{todayMenu.dinner_recipe?.name || 'No planificado'}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1"><Users size={12} /> Comensales:</span>
                  <span className="font-bold text-slate-800">
                    {(todayMenu.lunch_players || 0) + (todayMenu.dinner_players || 0)} jugadores
                  </span>
                </div>
                <div className="pt-2 text-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold ${todayMenu.confirmado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {todayMenu.confirmado ? '🟢 Confirmado (Stock descontado)' : '🟠 Pendiente de confirmar'}
                  </span>
                </div>
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
