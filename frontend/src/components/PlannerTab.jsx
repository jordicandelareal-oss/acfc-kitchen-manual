import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as api from '../api';
import * as mathUtils from '../utils/mathUtils';
import { PLANNER_RULES } from '../utils/plannerRules';
import PlannerSettingsModal from './PlannerSettingsModal';
import ShoppingListModal from './ShoppingListModal';
import { 
  LayoutDashboard, Bell, Search, Filter, Tag, Plus, Check, Trash2, 
  Settings, ShoppingCart, RefreshCw, X, ChevronLeft, ChevronRight, AlertTriangle 
} from 'lucide-react';

// Audit Console — captures window.addPlannerAuditLog into React state
function AuditConsole({ logs, onClear }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const colorClass = (type) => {
    if (type === 'error') return 'text-red-400 font-semibold';
    if (type === 'warn')  return 'text-amber-500 font-semibold';
    if (type === 'success') return 'text-green-400 font-bold';
    return 'text-slate-300';
  };

  return (
    <div className="xl:col-span-1 border border-slate-800 rounded-xl bg-slate-900 overflow-hidden shadow-xl flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest">🛠️ Diagnóstico</h4>
        </div>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-200 underline transition-colors font-semibold">
          Limpiar
        </button>
      </div>
      <div className="p-3 flex-grow overflow-hidden flex flex-col">
        <div ref={logRef} id="live-audit-logs" className="flex-grow overflow-y-auto font-mono text-[11px] space-y-1.5 pr-2 leading-relaxed max-h-[480px]">
          {logs.map((l, i) => (
            <p key={i} className={colorClass(l.type)}>
              {l.ts && <span className="text-slate-500">[{l.ts}] </span>}
              {l.msg}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// Nombre(s) de categoría que Supabase usa para las guarniciones/acompañamientos
const SIDE_CATEGORIES = ['acompañamiento', 'acompanamiento', 'guarnicion', 'guarnición', 'guarniciones', 'ensalada', 'side'];
const isSideRecipe = (r) => {
  const cat = (r.category || '').toLowerCase().trim();
  return SIDE_CATEGORIES.some(s => cat.includes(s));
};

// PlannerTab Component
export default function PlannerTab({ recipes = [] }) {
  const [plannerData, setPlannerData] = useState({});
  const [plannerSettings, setPlannerSettings] = useState(() => PLANNER_RULES.getSettings());
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeeks, setSelectedWeeks] = useState([1]);
  const [logs, setLogs] = useState([
    { type: 'info', msg: '[SISTEMA] Consola iniciada. Esperando eventos...', ts: new Date().toLocaleTimeString() }
  ]);

  // ── Derived recipe arrays (single source of truth for filtering) ──
  const sideRecipes = useMemo(() => recipes.filter(isSideRecipe), [recipes]);
  const mainRecipes = useMemo(() => recipes.filter(r => !isSideRecipe(r)), [recipes]);

  // Diagnostic: log unique categories on first recipe load
  const diagRef = React.useRef(false);
  useMemo(() => {
    if (recipes.length > 0 && !diagRef.current) {
      diagRef.current = true;
      const cats = [...new Set(recipes.map(r => r.category).filter(Boolean))].sort();
      console.log('[PlannerTab] Categorías únicas en recetas:', cats);
      console.log(`[PlannerTab] Platos principales: ${mainRecipes.length} | Guarniciones: ${sideRecipes.length}`);
    }
  }, [recipes, mainRecipes, sideRecipes]);

  // Modals
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [shoppingModalOpen, setShoppingModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Day Form State
  const [dayForm, setDayForm] = useState({
    breakfast_recipe_id: '',
    lunch_recipe_id: '',
    lunch_side_recipe_id: '',
    dinner_recipe_id: '',
    lunch_players: 0,
    lunch_halal: 0,
    lunch_kosher: 0,
    lunch_vegan: 0,
    lunch_allergies: '',
    dinner_players: 0,
    dinner_halal: 0,
    dinner_kosher: 0,
    dinner_vegan: 0,
    dinner_allergies: ''
  });

  const addLog = useCallback((msg, type = 'info') => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { type, msg, ts }].slice(-300));
  }, []);

  // Fetch Planner Data
  const loadData = useCallback(async () => {
    setLoading(true);
    addLog('Cargando planificación e inventario desde Supabase...', 'info');
    try {
      const [plannerRes, ingredientsRes] = await Promise.all([
        api.fetchPlannerDataDb(),
        api.fetchIngredients()
      ]);

      if (plannerRes.error) throw plannerRes.error;
      if (ingredientsRes.error) throw ingredientsRes.error;
      
      const plannerMap = {};
      if (plannerRes.data) {
        plannerRes.data.forEach(row => {
          if (row.date) {
            const day = new Date(row.date).getDate();
            plannerMap[day] = row;
          }
        });
      }
      setPlannerData(plannerMap);
      window.PLANNER_DATA = plannerMap;
      
      const invData = ingredientsRes.data || [];
      setInventory(invData);
      window.INVENTORY = invData;

      addLog(`Planificación e inventario cargados con éxito`, 'success');
    } catch (e) {
      addLog(`Error al cargar datos desde Supabase: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    loadData();
    window.refreshReactPlanner = loadData;
    window.addPlannerAuditLog = (msg, type = 'info') => addLog(msg, type);
    window.openPlannerDayModal = (day) => openDayEditor(day);
    return () => {
      window.refreshReactPlanner = null;
      window.addPlannerAuditLog = null;
      window.openPlannerDayModal = null;
    };
  }, [loadData, addLog]);

  const handleWeekToggle = (w) =>
    setSelectedWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);

  const handleReset = async () => {
    addLog('Iniciando borrado del planificador...', 'warn');
    try {
      const allDates = [];
      for (let i = 1; i <= 31; i++) {
        allDates.push(`2026-07-${String(i).padStart(2, '0')}`);
      }
      const { error } = await api.eliminarMenuYLiberarStock(allDates);
      if (error) throw error;
      addLog('Planificador reseteado y stock liberado con éxito en la base de datos', 'success');
      setResetModalOpen(false);
      loadData();
    } catch (e) {
      addLog(`Error al resetear planificador: ${e.message}`, 'error');
    }
  };

  const sanitizeRecipeId = (id) => {
    if (!id || String(id).trim() === '') return null;
    const exists = recipes.some(r => r.id === id);
    return exists ? id : null;
  };

  const handleSaveDay = async () => {
    if (!selectedDay) return;
    addLog(`Guardando día ${selectedDay} de Julio...`, 'info');
    try {
      const formattedDate = `2026-07-${String(selectedDay).padStart(2, '0')}`;
      
      const payload = {
        date: formattedDate,
        breakfast_recipe_id: sanitizeRecipeId(dayForm.breakfast_recipe_id),
        lunch_recipe_id: sanitizeRecipeId(dayForm.lunch_recipe_id),
        lunch_side_recipe_id: sanitizeRecipeId(dayForm.lunch_side_recipe_id),
        dinner_recipe_id: sanitizeRecipeId(dayForm.dinner_recipe_id),
        lunch_players: Number(dayForm.lunch_players) || 0,
        lunch_halal: Number(dayForm.lunch_halal) || 0,
        lunch_kosher: Number(dayForm.lunch_kosher) || 0,
        lunch_vegan: Number(dayForm.lunch_vegan) || 0,
        lunch_allergies: dayForm.lunch_allergies || '',
        dinner_players: Number(dayForm.dinner_players) || 0,
        dinner_halal: Number(dayForm.dinner_halal) || 0,
        dinner_kosher: Number(dayForm.dinner_kosher) || 0,
        dinner_vegan: Number(dayForm.dinner_vegan) || 0,
        dinner_allergies: dayForm.dinner_allergies || ''
      };
      
      console.log('Depurando objeto a guardar:', payload);
      
      const { error } = await api.guardarMenuYReservarStock([payload]);
      if (error) throw error;
      
      addLog(`Día ${selectedDay} guardado con éxito`, 'success');
      setDayModalOpen(false);
      loadData();
    } catch (e) {
      addLog(`Error al guardar día ${selectedDay}: ${e.message}`, 'error');
    }
  };

  const openDayEditor = (day) => {
    setSelectedDay(day);
    const dayData = plannerData[day] || {};
    setDayForm({
      breakfast_recipe_id: dayData.breakfast_recipe_id || '',
      lunch_recipe_id: dayData.lunch_recipe_id || '',
      lunch_side_recipe_id: dayData.lunch_side_recipe_id || '',
      dinner_recipe_id: dayData.dinner_recipe_id || '',
      lunch_players: dayData.lunch_players || 0,
      lunch_halal: dayData.lunch_halal || 0,
      lunch_kosher: dayData.lunch_kosher || 0,
      lunch_vegan: dayData.lunch_vegan || 0,
      lunch_allergies: dayData.lunch_allergies || '',
      dinner_players: dayData.dinner_players || 0,
      dinner_halal: dayData.dinner_halal || 0,
      dinner_kosher: dayData.dinner_kosher || 0,
      dinner_vegan: dayData.dinner_vegan || 0,
      dinner_allergies: dayData.dinner_allergies || ''
    });
    setDayModalOpen(true);
  };

  // Recipes lookup helper
  const getRecipeName = (id, fallback = 'Sin asignar') => {
    if (!id) return fallback;
    const r = recipes.find(rec => rec.id === id);
    return r ? r.name : fallback;
  };

  // Auto-generate weekly planner
  const handleGenerateWeekly = async () => {
    if (recipes.length === 0) {
      console.warn('PlannerTab: Intento de generación semanal fallido. El array de recetas globales está vacío.');
      addLog('⚠️ No hay recetas globales cargadas para autogenerar el menú', 'warn');
      return;
    }
    
    if (selectedWeeks.length === 0) {
      addLog('⚠️ Selecciona al menos una semana antes de generar', 'warn');
      return;
    }
    addLog(`Generando menú automático para semanas: ${selectedWeeks.join(', ')}...`, 'info');
    try {
      // Read active settings directly from React state to guarantee synchronization
      const settings = plannerSettings;
      console.log('Aplicando regla de guarnición:', settings['menu_setting_incluir_guarniciones']);
      
      const upserts = [];
      // Cola histórica de recetas asignadas recientemente para rotación (historial de últimos 5 días = 10 comidas)
      let recentRecipeIds = [];

      selectedWeeks.forEach(week => {
        const startDay = (week - 1) * 7 + 1;
        for (let offset = 0; offset < 7; offset++) {
          const day = startDay + offset;
          const isWeekend = (offset === 5 || offset === 6);
          
          if (day <= 31) {
            // ── EVALUACIÓN PASO A PASO: ALMUERZO ──
            let lunchRecipe = null;
            const lunchFailures = [];

            for (const candidate of mainRecipes) {
              const check = PLANNER_RULES.isRecipeValid(candidate, recentRecipeIds, settings, isWeekend, 'lunch');
              if (check.valid) {
                lunchRecipe = candidate;
                break;
              } else {
                lunchFailures.push({ name: candidate.name, reason: check.reason });
              }
            }

            if (!lunchRecipe) {
              console.error(`[Generador] No se encontró plato principal válido para almuerzo el día ${day}. Fallas registradas:`, lunchFailures);
              lunchRecipe = mainRecipes[0] || null; // Fallback
            }

            const randLunch = lunchRecipe?.id || null;
            if (randLunch) {
              recentRecipeIds.push(randLunch);
              console.log(`Generando para día ${day} (Almuerzo): "${lunchRecipe?.name}" | Categoría: ${lunchRecipe?.category}`);
            }

            // ── EVALUACIÓN PASO A PASO: GUARNICIÓN ──
            let randSide = null;
            if (settings['menu_setting_incluir_guarniciones']) {
              const sideFailures = [];
              for (const candidate of sideRecipes) {
                const check = PLANNER_RULES.isRecipeValid(candidate, recentRecipeIds, settings, isWeekend, 'lunch_side');
                if (check.valid) {
                  randSide = candidate.id;
                  break;
                } else {
                  sideFailures.push({ name: candidate.name, reason: check.reason });
                }
              }
              if (!randSide && sideRecipes.length > 0) {
                console.warn(`[Generador] No se encontró guarnición válida para día ${day}. Fallas:`, sideFailures);
                randSide = sideRecipes[0]?.id || null; // Fallback
              }
              if (randSide) {
                recentRecipeIds.push(randSide);
              }
            }

            // ── EVALUACIÓN PASO A PASO: CENA ──
            let dinnerRecipe = null;
            const dinnerFailures = [];

            for (const candidate of mainRecipes) {
              const check = PLANNER_RULES.isRecipeValid(candidate, recentRecipeIds, settings, isWeekend, 'dinner', lunchRecipe);
              if (check.valid) {
                dinnerRecipe = candidate;
                break;
              } else {
                dinnerFailures.push({ name: candidate.name, reason: check.reason });
              }
            }

            if (!dinnerRecipe) {
              console.error(`[Generador] No se encontró plato válido para cena el día ${day}. Fallas registradas:`, dinnerFailures);
              dinnerRecipe = mainRecipes[0] || null; // Fallback
            }

            const randDinner = dinnerRecipe?.id || null;
            if (randDinner) {
              recentRecipeIds.push(randDinner);
              console.log(`Generando para día ${day} (Cena): "${dinnerRecipe?.name}" | Categoría: ${dinnerRecipe?.category}`);
            }

            // Mantener la cola de rotación en los últimos 10 platos (aprox. 5 días de almuerzo y cena)
            if (recentRecipeIds.length > 10) {
              recentRecipeIds = recentRecipeIds.slice(-10);
            }

            upserts.push({
              date: `2026-07-${String(day).padStart(2, '0')}`,
              breakfast_recipe_id: sanitizeRecipeId('d9b736b4-2db2-4809-913a-c80f4f81c944'),
              lunch_recipe_id: randLunch,
              lunch_side_recipe_id: randSide,
              dinner_recipe_id: randDinner,
              lunch_players: 25,
              lunch_halal: 2,
              lunch_kosher: 1,
              lunch_vegan: 2,
              lunch_allergies: '1 Celíaco',
              dinner_players: 20,
              dinner_halal: 1,
              dinner_kosher: 0,
              dinner_vegan: 1,
              dinner_allergies: ''
            });
          }
        }
      });

      const { error } = await api.guardarMenuYReservarStock(upserts);
      if (error) throw error;
      
      addLog(`Menú semanal autogenerado para semanas ${selectedWeeks.join(', ')}`, 'success');
      loadData();
    } catch (e) {
      addLog(`Error al autogenerar menú: ${e.message}`, 'error');
    }
  };

  // Save All and Confirm Menu
  const handleSaveAndConfirm = async () => {
    addLog('Guardando menú y descontando reservas de existencias en stock...', 'info');
    try {
      const menuDays = Object.values(plannerData);
      if (menuDays.length === 0) {
        addLog('No hay días planificados para confirmar', 'warn');
        return;
      }
      const { error } = await api.guardarYConfirmarMenu(menuDays);
      if (error) throw error;
      addLog('¡Inventario reservado y menú semanal confirmado con éxito!', 'success');
      loadData();
    } catch (e) {
      addLog(`Error al guardar y confirmar stock: ${e.message}`, 'error');
    }
  };

  // ── Auto-suggest a side dish when the lunch recipe changes ────────────────
  const autoSuggestSide = (lunchRecipeId) => {
    if (!lunchRecipeId || sideRecipes.length === 0) return;

    const lunchRecipe = recipes.find(r => r.id === lunchRecipeId);
    if (!lunchRecipe) return;

    const name = (lunchRecipe.name || '').toLowerCase();
    const cat  = (lunchRecipe.category || '').toLowerCase();
    const sub  = (lunchRecipe.subcategory || '').toLowerCase();

    // Priority rules (first match wins)
    const rules = [
      // Pasta/Arroz/Paella → ensalada verde
      { test: () => name.includes('pasta') || name.includes('macarr') || name.includes('tallar') || name.includes('arroz') || name.includes('paella'),
        keyword: 'ensalada' },
      // Carne roja → patatas o puré
      { test: () => cat === 'carne' || sub.includes('carne') || name.includes('estofado') || name.includes('asado'),
        keyword: 'patata' },
      // Pescado → ensalada o verdura
      { test: () => cat === 'pescado' || sub.includes('pescado') || name.includes('merluza') || name.includes('salmón') || name.includes('bacalao'),
        keyword: 'ensalada' },
      // Legumbres → ensalada
      { test: () => name.includes('lenteja') || name.includes('garbanzo') || name.includes('judía') || name.includes('habas'),
        keyword: 'ensalada' },
    ];

    let suggested = null;
    for (const rule of rules) {
      if (rule.test()) {
        suggested = sideRecipes.find(r => (r.name || '').toLowerCase().includes(rule.keyword));
        if (suggested) break;
      }
    }

    // Fallback: pick the first available side dish
    if (!suggested) suggested = sideRecipes[0];

    if (suggested) {
      console.log(`[Planificador] Guarnición auto-sugerida: "${suggested.name}" para plato "${lunchRecipe.name}"`);
      setDayForm(prev => ({ ...prev, lunch_side_recipe_id: suggested.id }));
    }
  };

  return (
    <div className="w-full flex flex-col gap-5">
      
      {/* ── TOOLBAR PLANIFICADOR (STICKY TOP FIXED BAR) ── */}
      <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur py-3 flex flex-wrap justify-between items-center gap-4 border-b border-slate-200/60">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Planificador Mensual</h1>
          <p className="text-xs text-slate-500 mt-0.5">Julio 2026 — Menú diario almuerzo + cena</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          
          {/* Reset button */}
          <button 
            onClick={() => setResetModalOpen(true)}
            className="border border-red-200 text-red-600 bg-white hover:bg-red-50 font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-all text-xs whitespace-nowrap"
          >
            <Trash2 size={15} />
            <span>Resetear</span>
          </button>
          
          {/* Week selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Sem:</span>
            {[1, 2, 3, 4].map(w => (
              <label key={w} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={selectedWeeks.includes(w)}
                  onChange={() => handleWeekToggle(w)}
                  className="rounded border-slate-300 text-brand focus:ring-brand w-3.5 h-3.5"
                />
                <span>{w}</span>
              </label>
            ))}
          </div>

          {/* Auto-generate button */}
          <button 
            onClick={handleGenerateWeekly}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-semibold hover:shadow-md transition-all whitespace-nowrap"
          >
            <RefreshCw size={14} className="animate-pulse" />
            <span>Generar Menú Semanal</span>
          </button>

          {/* Save / Reserve Stock button */}
          <button 
            onClick={handleSaveAndConfirm}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold hover:shadow-md transition-all whitespace-nowrap"
          >
            <Check size={14} />
            <span>Guardar Menú y Descontar Stock</span>
          </button>

          {/* Shopping list button */}
          <button 
            onClick={() => setShoppingModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition-all whitespace-nowrap"
          >
            <ShoppingCart size={14} />
            <span>Lista compra</span>
          </button>

          {/* Settings button */}
          <button 
            onClick={() => setSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all whitespace-nowrap"
          >
            <Settings size={14} />
            <span>Ajustes Menú</span>
          </button>

          {/* Month Navigator */}
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <button className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500">
              <ChevronLeft size={16} />
            </button>
            <span className="font-semibold text-slate-700 text-xs px-1">Jul 2026</span>
            <button className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── GRID + DIAGNOSTIC CONSOLE ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 items-start">
        
        {/* Calendar Grid */}
        <div className="xl:col-span-3 space-y-4">
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-brand inline-block" /> Hoy
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200 inline-block" /> Menú planificado
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" /> Sin planificar
            </div>
          </div>

          <div className="hidden md:grid grid-cols-7 gap-2">
            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 uppercase py-1">{d}</div>
            ))}
          </div>

          {/* Desktop Days Grid - React Pure Rendering */}
          <div className="hidden md:grid grid-cols-7 gap-2">
            {Array.from({ length: 31 }, (_, i) => {
              const d = i + 1;
              const isToday = d === new Date().getDate();
              const menu = plannerData[d] || null;

              const lunchName = getRecipeName(menu?.lunch_recipe_id, 'Sin asignar');
              const lunchSideName = getRecipeName(menu?.lunch_side_recipe_id, '');
              const dinnerName = getRecipeName(menu?.dinner_recipe_id, 'Sin asignar');

              const hasMeal = menu && (menu.lunch_recipe_id || menu.dinner_recipe_id);

              return (
                <div 
                  key={d}
                  className={`card p-3 min-h-[140px] flex flex-col justify-between transition-all ${
                    isToday 
                      ? 'ring-2 ring-brand ring-offset-2 bg-brand-muted/20 border-brand' 
                      : hasMeal 
                        ? 'bg-indigo-50/40 border-indigo-200 shadow-sm' 
                        : 'bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-xs font-bold font-display ${isToday ? 'text-brand' : 'text-slate-500'}`}>{d}</span>
                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>}
                  </div>

                  <div className="mt-2 space-y-1 flex-grow">
                    <div className={`text-[10px] truncate leading-normal ${menu?.lunch_recipe_id ? 'text-brand font-semibold' : 'text-slate-400 italic'}`}>
                      🌞 {lunchName}
                    </div>
                    {lunchSideName && (
                      <div className="text-[9px] truncate leading-normal text-emerald-600 font-medium pl-2">
                        🥗 {lunchSideName}
                      </div>
                    )}
                    <div className={`text-[10px] truncate leading-normal ${menu?.dinner_recipe_id ? 'text-indigo-600 font-semibold' : 'text-slate-400 italic'}`}>
                      🌙 {dinnerName}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100/50 flex justify-between items-center text-[10px] text-slate-400">
                    <span>👥 {menu?.lunch_players || 0}</span>
                    <button 
                      onClick={() => openDayEditor(d)} 
                      className="text-brand hover:underline font-bold transition-all cursor-pointer"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Audit Diagnostics Console */}
        <AuditConsole logs={logs} onClear={() => setLogs([{ type: 'info', msg: '[INFO] Consola vacía. Listo para auditar.', ts: new Date().toLocaleTimeString() }])} />
      </div>

      {/* ── MODAL: EDITAR PLANIFICACIÓN DÍA (REACT) ── */}
      {dayModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setDayModalOpen(false); }}>
          <div className="modal-box max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-5 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Planificar Día</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedDay} de Julio 2026</p>
              </div>
              <button onClick={() => setDayModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              
              {/* Almuerzo Select */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">🌞 Almuerzo (Plato Principal)</label>
                <select 
                  value={dayForm.lunch_recipe_id} 
                  onChange={e => {
                    const val = e.target.value;
                    setDayForm(prev => ({ ...prev, lunch_recipe_id: val }));
                    // Auto-suggest matching side dish unless one is already set
                    if (!dayForm.lunch_side_recipe_id) {
                      autoSuggestSide(val);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                >
                  <option value="">Selecciona una receta...</option>
                  {mainRecipes.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Acompañamiento Select — auto-suggested, manually overridable */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">🥗 Acompañamiento (Guarnición)</label>
                  {dayForm.lunch_side_recipe_id && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      ✨ Auto-sugerida
                    </span>
                  )}
                </div>
                <select 
                  value={dayForm.lunch_side_recipe_id} 
                  onChange={e => setDayForm(prev => ({ ...prev, lunch_side_recipe_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                >
                  <option value="">Sin guarnición</option>
                  {sideRecipes.length === 0 ? (
                    <option disabled value="">⚠️ Sin guarniciones en Supabase</option>
                  ) : (
                    sideRecipes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))
                  )}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 italic">Se sugiere automáticamente según el plato principal. Puedes cambiarla.</p>
              </div>

              {/* Cena Select */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">🌙 Cena</label>
                <select 
                  value={dayForm.dinner_recipe_id} 
                  onChange={e => setDayForm(prev => ({ ...prev, dinner_recipe_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                >
                  <option value="">Selecciona una receta...</option>
                  {mainRecipes.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Stats & Players */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Comensales</label>
                  <input 
                    type="number" 
                    value={dayForm.lunch_players} 
                    onChange={e => setDayForm(prev => ({ ...prev, lunch_players: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Halal</label>
                  <input 
                    type="number" 
                    value={dayForm.lunch_halal} 
                    onChange={e => setDayForm(prev => ({ ...prev, lunch_halal: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Kosher</label>
                  <input 
                    type="number" 
                    value={dayForm.lunch_kosher} 
                    onChange={e => setDayForm(prev => ({ ...prev, lunch_kosher: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Vegano</label>
                  <input 
                    type="number" 
                    value={dayForm.lunch_vegan} 
                    onChange={e => setDayForm(prev => ({ ...prev, lunch_vegan: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Alergias / Notas del día</label>
                <input 
                  type="text" 
                  value={dayForm.lunch_allergies} 
                  onChange={e => setDayForm(prev => ({ ...prev, lunch_allergies: e.target.value }))}
                  placeholder="Ej: Celíacos, Sin frutos secos"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                />
              </div>

            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setDayModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveDay} className="px-5 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg shadow-sm transition-all">
                Guardar Día
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRMACIÓN RESET ── */}
      {resetModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setResetModalOpen(false); }}>
          <div className="modal-box max-w-sm">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size={32} />
              <h3 className="text-lg font-bold" style={{ fontFamily: 'Outfit' }}>¿Resetear Planificador?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Esta acción vaciará por completo la planificación de todo el mes de Julio. No se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setResetModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
                Cancelar
              </button>
              <button onClick={handleReset} className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-all">
                Confirmar Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: LISTA DE COMPRAS (REACT MODULAR) ── */}
      <ShoppingListModal 
        isOpen={shoppingModalOpen}
        onClose={() => setShoppingModalOpen(false)}
        plannerData={plannerData}
        recipes={recipes}
        inventory={inventory}
      />
      
      {/* ── MODAL: AJUSTES GENERACIÓN (REACT) ── */}
      <PlannerSettingsModal 
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={(newSettings) => {
          setPlannerSettings(newSettings);
          addLog('Ajustes del generador guardados. Regenerando caché de reglas...', 'success');
        }}
      />

    </div>
  );
}
