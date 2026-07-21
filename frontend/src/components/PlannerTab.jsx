import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as api from '../api';
import * as mathUtils from '../utils/mathUtils';
import { PLANNER_RULES } from '../utils/plannerRules';
import PlannerSettingsModal from './PlannerSettingsModal';
import ShoppingListModal from './ShoppingListModal';
import { 
  LayoutDashboard, Bell, Search, Filter, Tag, Plus, Check, Trash2, 
  Settings, ShoppingCart, RefreshCw, X, ChevronLeft, ChevronRight, AlertTriangle, Users 
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
  return SIDE_CATEGORIES.some(s => cat === s || cat.includes(s));
};

// PlannerTab Component
export default function PlannerTab({ recipes = [] }) {
  const [plannerData, setPlannerData] = useState({});
  const [plannerSettings, setPlannerSettings] = useState(() => PLANNER_RULES.getSettings());
  const [inventory, setInventory] = useState([]);
  const [selectedWeeks, setSelectedWeeks] = useState([1]);
  const [logs, setLogs] = useState([
    { type: 'info', msg: '[SISTEMA] Consola iniciada. Esperando eventos...', ts: new Date().toLocaleTimeString() }
  ]);
  const [loading, setLoading] = useState(false);
  // Estado de comensales configurados por semana { 1: { lunch: 25, dinner: 20 }, ... }
  const [weeklyPlayers, setWeeklyPlayers] = useState(() => {
    const stored = localStorage.getItem('acfc_weekly_players_v2');
    if (stored) {
      try { return JSON.parse(stored); } catch (e) { /* fallback */ }
    }
    return {
      1: { lunch: 25, dinner: 20 },
      2: { lunch: 25, dinner: 20 },
      3: { lunch: 25, dinner: 20 },
      4: { lunch: 25, dinner: 20 }
    };
  });

  const handleUpdateMealPlayers = (weekNum, mealType, delta) => {
    setWeeklyPlayers(prev => {
      const currentWeekObj = prev[weekNum] || { lunch: 25, dinner: 20 };
      const currentVal = currentWeekObj[mealType] !== undefined ? currentWeekObj[mealType] : (mealType === 'lunch' ? 25 : 20);
      const nextVal = Math.max(1, currentVal + delta);
      const updated = { 
        ...prev, 
        [weekNum]: { 
          ...currentWeekObj, 
          [mealType]: nextVal 
        } 
      };
      localStorage.setItem('acfc_weekly_players_v2', JSON.stringify(updated));
      return updated;
    });
  };

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

  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 6, 1)); // Default: Julio 2026

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Fetch Planner Data & Process Automatic Shift Deductions
  const loadData = useCallback(async () => {
    setLoading(true);
    addLog('Cargando planificación e inventario desde Supabase...', 'info');
    try {
      // 1. Verificación automática de turnos transcurridos (09:00, 13:00, 19:00)
      const autoRes = await api.procesarDescuentosAutomaticosTurnos();
      if (autoRes.data && autoRes.data.processed_count > 0) {
        addLog(`⏱️ Se procesaron automáticamente ${autoRes.data.processed_count} servicio(s) transcurridos`, 'success');
      }

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
            // Indexar por ISO 'YYYY-MM-DD'
            plannerMap[row.date] = row;
            
            // Indexar también por número del día (ej. 1, 2, 3...)
            const dayNum = parseInt(String(row.date).split('-')[2], 10);
            if (!isNaN(dayNum)) {
              plannerMap[dayNum] = row;
            }
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

  const [resetScope, setResetScope] = useState('month'); // 'day' | 'week' | 'month'

  const handleReset = async () => {
    addLog(`Iniciando vaciado del planificador (Alcance: ${resetScope})...`, 'warn');
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      let datesToReset = [];

      if (resetScope === 'day') {
        if (!selectedDay) {
          if (typeof window.toast === 'function') window.toast('⚠️ Selecciona primero un día para vaciar');
          return;
        }
        const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        datesToReset = [dateISO];
      } else if (resetScope === 'week') {
        if (!selectedWeeks || selectedWeeks.length === 0) {
          if (typeof window.toast === 'function') window.toast('⚠️ No hay ninguna semana activa en el filtro');
          return;
        }
        // Calculate days belonging to selected weeks in current month
        selectedWeeks.forEach(w => {
          const startDay = (w - 1) * 7 + 1;
          const endDay = Math.min(w * 7, new Date(year, month + 1, 0).getDate());
          for (let d = startDay; d <= endDay; d++) {
            datesToReset.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
          }
        });
      } else {
        // Full Month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          datesToReset.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      }

      if (datesToReset.length === 0) {
        addLog('No hay fechas seleccionadas para vaciar.', 'warn');
        return;
      }

      const { error } = await api.eliminarMenuYLiberarStock(datesToReset);
      if (error) throw error;

      const scopeText = resetScope === 'day' ? `Día ${selectedDay}` : resetScope === 'week' ? `Semanas (${selectedWeeks.join(', ')})` : 'Mes completo';
      addLog(`Planificación vaciada y stock liberado con éxito para: ${scopeText}`, 'success');
      
      if (typeof window.toast === 'function') {
        window.toast(`🗑️ Reseteo completado (${scopeText}) y stock liberado.`);
      }

      setResetModalOpen(false);
      if (resetScope === 'day') setDayModalOpen(false);
      loadData();
    } catch (e) {
      addLog(`Error al resetear planificador: ${e.message}`, 'error');
      if (typeof window.toast === 'function') {
        window.toast(`❌ Error al resetear: ${e.message}`);
      }
    }
  };

  const sanitizeRecipeId = (id) => {
    if (!id || String(id).trim() === '') return null;
    const exists = recipes.some(r => r.id === id);
    return exists ? id : null;
  };

  const handleSaveDay = async () => {
    if (!selectedDay) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    addLog(`Guardando día ${selectedDay} (${formattedDate})...`, 'info');
    try {
      
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

      // Actualizar estado local inmediatamente para refrescar la tarjeta visual al instante
      setPlannerData(prev => {
        const nextMap = { ...prev };
        nextMap[formattedDate] = { ...nextMap[formattedDate], ...payload };
        nextMap[selectedDay] = { ...nextMap[selectedDay], ...payload };
        return nextMap;
      });
      
      addLog(`Día ${selectedDay} guardado con éxito`, 'success');
      setDayModalOpen(false);
      loadData();
    } catch (e) {
      addLog(`Error al guardar día ${selectedDay}: ${e.message}`, 'error');
    }
  };

  const openDayEditor = (day) => {
    setSelectedDay(day);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Search plannerData using ISO date string first, then by numeric day
    const dayData = plannerData[dateISO] || plannerData[day] || {};
    
    const savedSideId = dayData.lunch_side_recipe_id || dayData.lunch_side_recipe?.id || '';

    setDayForm({
      breakfast_recipe_id: dayData.breakfast_recipe_id || '',
      lunch_recipe_id: dayData.lunch_recipe_id || '',
      lunch_side_recipe_id: savedSideId,
      dinner_recipe_id: dayData.dinner_recipe_id || '',
      lunch_players: dayData.lunch_players || 25,
      lunch_halal: dayData.lunch_halal || 0,
      lunch_kosher: dayData.lunch_kosher || 0,
      lunch_vegan: dayData.lunch_vegan || 0,
      lunch_allergies: dayData.lunch_allergies || '',
      dinner_players: dayData.dinner_players || 20,
      dinner_halal: dayData.dinner_halal || 0,
      dinner_kosher: dayData.dinner_kosher || 0,
      dinner_vegan: dayData.dinner_vegan || 0,
      dinner_allergies: dayData.dinner_allergies || ''
    });

    // Run auto-suggest if a main meal exists but side wasn't stored
    if (dayData.lunch_recipe_id && !dayData.lunch_side_recipe_id) {
      setTimeout(() => autoSuggestSide(dayData.lunch_recipe_id), 50);
    }

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
      let recentRecipeIds = [];
      let recentSideIds = [];
      const weekSideCounts = {};

      const defaultLunchPlayers = Number(settings['menu_setting_default_lunch_players']) || 25;
      const defaultDinnerPlayers = Number(settings['menu_setting_default_dinner_players']) || 20;

      // Helper for Fisher-Yates array shuffle to guarantee random uniform rotation
      const shuffleArray = (arr) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      selectedWeeks.forEach(week => {
        const startDay = (week - 1) * 7 + 1;
        for (let offset = 0; offset < 7; offset++) {
          const day = startDay + offset;
          const isWeekend = (offset === 5 || offset === 6);
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          
          if (day <= daysInMonth) {
            const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // ── EVALUACIÓN PASO A PASO: ALMUERZO ──
            let lunchRecipe = null;
            const shuffledMainsForLunch = shuffleArray(mainRecipes);

            for (const candidate of shuffledMainsForLunch) {
              const check = PLANNER_RULES.isRecipeValid(candidate, recentRecipeIds, settings, isWeekend, 'lunch');
              if (check.valid) {
                lunchRecipe = candidate;
                break;
              }
            }

            if (!lunchRecipe) {
              // Fallback to any main recipe not recently served if strict rules exclude all
              lunchRecipe = shuffledMainsForLunch.find(r => !recentRecipeIds.slice(-5).includes(r.id)) || shuffledMainsForLunch[0] || null;
            }

            const randLunch = lunchRecipe?.id || null;
            if (randLunch) {
              recentRecipeIds.push(randLunch);
            }

            // ── EVALUACIÓN PASO A PASO: GUARNICIÓN ──
            let randSide = null;
            if (settings['menu_setting_incluir_guarniciones'] !== false) {
              const shuffledSides = shuffleArray(sideRecipes);
              
              // Inicializar mapa de uso por semana si no existe
              if (!weekSideCounts[week]) weekSideCounts[week] = {};

              // Filtrar guarniciones válidas:
              // 1. Que no se hayan servido el día inmediatamente anterior (no consecutivas)
              // 2. Que no superen el máximo de 2 repeticiones en la misma semana
              const allowedSides = shuffledSides.filter(candidate => {
                const countInWeek = weekSideCounts[week][candidate.id] || 0;
                const wasServedYesterday = recentSideIds.length > 0 && recentSideIds[recentSideIds.length - 1] === candidate.id;
                const check = PLANNER_RULES.isRecipeValid(candidate, [], settings, isWeekend, 'lunch_side');
                return check.valid && !wasServedYesterday && countInWeek < 2;
              });

              if (allowedSides.length > 0) {
                randSide = allowedSides[0].id;
              } else if (sideRecipes.length > 0) {
                // Fallback: seleccionar cualquier guarnición no servida ayer
                const fallbackSide = shuffledSides.find(s => recentSideIds.length === 0 || recentSideIds[recentSideIds.length - 1] !== s.id) || shuffledSides[0];
                randSide = fallbackSide?.id || null;
              }

              if (randSide) {
                recentRecipeIds.push(randSide);
                recentSideIds.push(randSide);
                weekSideCounts[week][randSide] = (weekSideCounts[week][randSide] || 0) + 1;
              }
            }

            // ── EVALUACIÓN PASO A PASO: CENA ──
            let dinnerRecipe = null;
            const shuffledMainsForDinner = shuffleArray(mainRecipes);

            for (const candidate of shuffledMainsForDinner) {
              const check = PLANNER_RULES.isRecipeValid(candidate, recentRecipeIds, settings, isWeekend, 'dinner', lunchRecipe);
              if (check.valid) {
                dinnerRecipe = candidate;
                break;
              }
            }

            if (!dinnerRecipe) {
              dinnerRecipe = shuffledMainsForDinner.find(r => r.id !== randLunch && !recentRecipeIds.slice(-5).includes(r.id)) || shuffledMainsForDinner[0] || null;
            }

            const randDinner = dinnerRecipe?.id || null;
            if (randDinner) {
              recentRecipeIds.push(randDinner);
            }

            // Mantener cola de rotación amplia (últimos 14 platos servidos)
            if (recentRecipeIds.length > 14) {
              recentRecipeIds = recentRecipeIds.slice(-14);
            }

            // Número de comensales asignado específicamente a esta semana (Comida y Cena independientes)
            const weekLunchPlayers = Number(weeklyPlayers[week]?.lunch) || defaultLunchPlayers;
            const weekDinnerPlayers = Number(weeklyPlayers[week]?.dinner) || defaultDinnerPlayers;

            upserts.push({
              date: dateISO,
              breakfast_recipe_id: sanitizeRecipeId('d9b736b4-2db2-4809-913a-c80f4f81c944'),
              lunch_recipe_id: randLunch,
              lunch_side_recipe_id: randSide,
              dinner_recipe_id: randDinner,
              lunch_players: weekLunchPlayers,
              lunch_halal: Math.round(weekLunchPlayers * 0.08),
              lunch_kosher: Math.round(weekLunchPlayers * 0.04),
              lunch_vegan: Math.round(weekLunchPlayers * 0.08),
              lunch_allergies: '1 Celíaco',
              dinner_players: weekDinnerPlayers,
              dinner_halal: Math.round(weekDinnerPlayers * 0.05),
              dinner_kosher: 0,
              dinner_vegan: Math.round(weekDinnerPlayers * 0.05),
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

      if (selectedDay) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        
        setPlannerData(prev => ({
          ...prev,
          [formattedDate]: { ...prev[formattedDate], lunch_side_recipe_id: suggested.id },
          [selectedDay]: { ...prev[selectedDay], lunch_side_recipe_id: suggested.id }
        }));
      }
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

          {/* Quick Weekly Players Controls — Independent Lunch & Dinner */}
          <div className="flex items-center gap-2 bg-indigo-50/80 border border-indigo-200 p-1.5 rounded-xl">
            <Users size={14} className="text-indigo-600 ml-1" />
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight hidden lg:inline">
              Sem {selectedWeeks[0] || 1}:
            </span>
            
            {/* Comida / Lunch */}
            <div className="flex items-center gap-1 bg-white border border-brand/30 rounded-lg px-1.5 py-0.5 shadow-xs" title="Comensales Almuerzo">
              <span className="text-[10px] font-bold text-brand">🌞</span>
              <button 
                onClick={() => handleUpdateMealPlayers(selectedWeeks[0] || 1, 'lunch', -1)}
                className="w-4 h-4 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded transition-colors text-xs cursor-pointer"
              >
                -
              </button>
              <span className="font-extrabold text-xs text-slate-800 min-w-[20px] text-center">
                {weeklyPlayers[selectedWeeks[0] || 1]?.lunch ?? 25}
              </span>
              <button 
                onClick={() => handleUpdateMealPlayers(selectedWeeks[0] || 1, 'lunch', 1)}
                className="w-4 h-4 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded transition-colors text-xs cursor-pointer"
              >
                +
              </button>
            </div>

            {/* Cena / Dinner */}
            <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-lg px-1.5 py-0.5 shadow-xs" title="Comensales Cena">
              <span className="text-[10px] font-bold text-indigo-600">🌙</span>
              <button 
                onClick={() => handleUpdateMealPlayers(selectedWeeks[0] || 1, 'dinner', -1)}
                className="w-4 h-4 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded transition-colors text-xs cursor-pointer"
              >
                -
              </button>
              <span className="font-extrabold text-xs text-indigo-950 min-w-[20px] text-center">
                {weeklyPlayers[selectedWeeks[0] || 1]?.dinner ?? 20}
              </span>
              <button 
                onClick={() => handleUpdateMealPlayers(selectedWeeks[0] || 1, 'dinner', 1)}
                className="w-4 h-4 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded transition-colors text-xs cursor-pointer"
              >
                +
              </button>
            </div>
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
            <span>Guardar Planificación</span>
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
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-semibold text-slate-700 text-xs px-1 min-w-[70px] text-center">
              {currentDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer"
              title="Mes siguiente"
            >
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

          {/* Desktop Days Grid - Dynamic Calendar Alignment */}
          <div className="hidden md:grid grid-cols-7 gap-2">
            {(() => {
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth();
              
              // Days in month
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              
              // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
              // Convert to Spanish Monday-first index: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
              const rawFirstDay = new Date(year, month, 1).getDay();
              const firstDayOffset = (rawFirstDay === 0 ? 6 : rawFirstDay - 1);
              
              const now = new Date();
              const isCurrentMonthYear = now.getFullYear() === year && now.getMonth() === month;

              const elements = [];

              // Render empty offset cells
              for (let empty = 0; empty < firstDayOffset; empty++) {
                elements.push(
                  <div key={`empty-${empty}`} className="min-h-[140px] bg-slate-50/40 border border-dashed border-slate-100 rounded-xl" />
                );
              }

              // Render days
              for (let d = 1; d <= daysInMonth; d++) {
                const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isToday = isCurrentMonthYear && d === now.getDate();
                const menu = plannerData[dateISO] || plannerData[d] || null;

                const lunchName = menu?.lunch_recipe?.name || getRecipeName(menu?.lunch_recipe_id || menu?.lunch_recipe, 'Sin asignar');
                const rawSideId = menu?.lunch_side_recipe_id || menu?.lunch_side_recipe || menu?.side_dish || menu?.guarnicion;
                const lunchSideName = menu?.lunch_side_recipe?.name || (typeof rawSideId === 'object' ? rawSideId?.name : getRecipeName(rawSideId, ''));
                const dinnerName = menu?.dinner_recipe?.name || getRecipeName(menu?.dinner_recipe_id || menu?.dinner_recipe, 'Sin asignar');

                const hasMeal = menu && (menu.lunch_recipe_id || menu.dinner_recipe_id);

                elements.push(
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

                    <div className="mt-2 space-y-1 flex-grow overflow-hidden">
                      {/* 1. Almuerzo / Plato Principal */}
                      <div 
                        title={`Almuerzo: ${lunchName}`}
                        className={`p-1.5 rounded-md text-[10px] font-medium leading-tight border overflow-hidden ${
                          menu?.lunch_recipe_id 
                            ? 'bg-amber-50/90 border-amber-200 text-amber-950' 
                            : 'bg-slate-50/60 border-slate-100 text-slate-400 italic'
                        }`}
                      >
                        <div className="font-bold text-amber-700 text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <span>☀️ Almuerzo</span>
                        </div>
                        <span className="font-semibold block truncate">{lunchName}</span>
                      </div>

                      {/* 2. Guarnición (BLOQUE FIJO INCONDICIONAL) */}
                      <div 
                        title={`Guarnición: ${lunchSideName || 'Sin guarnición asignada'}`}
                        className={`p-1 rounded-md text-[10px] leading-tight border flex items-center gap-1 overflow-hidden ${
                          lunchSideName 
                            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950' 
                            : 'bg-slate-50/60 border-slate-100 text-slate-400 italic'
                        }`}
                      >
                        <span className="font-bold text-emerald-600 flex-shrink-0 text-[9px]">🥗</span>
                        <span className="font-semibold block truncate">
                          {lunchSideName || 'Sin guarnición asignada'}
                        </span>
                      </div>

                      {/* 3. Cena */}
                      <div 
                        title={`Cena: ${dinnerName}`}
                        className={`p-1.5 rounded-md text-[10px] font-medium leading-snug border overflow-hidden ${
                          menu?.dinner_recipe_id 
                            ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950' 
                            : 'bg-slate-50/60 border-slate-100 text-slate-400 italic'
                        }`}
                      >
                        <div className="font-bold text-indigo-700 text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <span>🌙 Cena</span>
                        </div>
                        <span className="font-semibold block truncate">{dinnerName}</span>
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
              }

              return elements;
            })()}
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
                    autoSuggestSide(val);
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

      {/* ── MODAL: CONFIRMACIÓN RESET CON OPCIONES DE ALCANCE ── */}
      {resetModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setResetModalOpen(false); }}>
          <div className="modal-box max-w-md">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size={28} />
              <div>
                <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Vaciar Planificación</h3>
                <p className="text-xs text-slate-400">Selecciona el alcance del borrado</p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${resetScope === 'day' ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="radio" 
                  name="resetScope" 
                  value="day" 
                  checked={resetScope === 'day'} 
                  onChange={() => setResetScope('day')}
                  className="mt-0.5 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Día actual / seleccionado</span>
                  <span className="text-[11px] text-slate-500">Vacía únicamente las comidas del día {selectedDay || 'actual'}.</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${resetScope === 'week' ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="radio" 
                  name="resetScope" 
                  value="week" 
                  checked={resetScope === 'week'} 
                  onChange={() => setResetScope('week')}
                  className="mt-0.5 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Semana(s) seleccionada(s)</span>
                  <span className="text-[11px] text-slate-500">Vacía únicamente los días de las semanas activas ({selectedWeeks.join(', ')}).</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${resetScope === 'month' ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input 
                  type="radio" 
                  name="resetScope" 
                  value="month" 
                  checked={resetScope === 'month'} 
                  onChange={() => setResetScope('month')}
                  className="mt-0.5 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Mes entero ({currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })})</span>
                  <span className="text-[11px] text-slate-500">Vacía toda la planificación del mes en curso y libera todas las reservas.</span>
                </div>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 mb-6 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              💡 Esta acción liberará automáticamente el stock reservado correspondiente en la base de datos de Supabase.
            </p>

            <div className="flex justify-end gap-3">
              <button onClick={() => setResetModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
                Cancelar
              </button>
              <button onClick={handleReset} className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-all">
                Confirmar Borrado
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
