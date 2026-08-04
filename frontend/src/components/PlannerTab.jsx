import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as api from '../api';
import * as mathUtils from '../utils/mathUtils';
import { PLANNER_RULES } from '../utils/plannerRules';
import PlannerSettingsModal from './PlannerSettingsModal';
import ShoppingListModal from './ShoppingListModal';
import ComensalesModal from './ComensalesModal';
import { 
  getMadridTodayStr, 
  getMadridTodayDateObject, 
  getMadridWeekdayIndex, 
  isTodayInMadrid,
  getMadridWeekRange,
  getMadridWeeksInMonth,
  getMadridWeekdayIndexForDate,
  getMadridMondayOfWeek,
  getMadridWeekRangeLabelForSelector
} from '../utils/dateUtils';
import { 
  LayoutDashboard, Bell, Search, Filter, Tag, Plus, Check, Trash2, 
  Settings, ShoppingCart, RefreshCw, X, ChevronLeft, ChevronRight, AlertTriangle, Users, Edit2, Calendar 
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
    <div className="hidden md:flex xl:col-span-1 border border-slate-800 rounded-xl bg-slate-900 overflow-hidden shadow-xl flex-col h-full min-h-[400px]">
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

const getDaysInRange = (startStr, endStr) => {
  const days = [];
  if (!startStr || !endStr) return days;
  
  const [sY, sM, sD] = startStr.split('-').map(Number);
  const [eY, eM, eD] = endStr.split('-').map(Number);
  
  const start = new Date(sY, sM - 1, sD);
  const end = new Date(eY, eM - 1, eD);
  
  const current = new Date(start);
  const weekdaysText = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  let iterations = 0;
  while (current <= end && iterations < 100) {
    iterations++;
    const dtfISO = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const dateStr = dtfISO.format(current);
    
    days.push({
      dateStr: dateStr,
      dayNum: current.getDate(),
      month: current.getMonth(),
      year: current.getFullYear(),
      dayLabel: weekdaysText[current.getDay()]
    });
    
    current.setDate(current.getDate() + 1);
  }
  return days;
};

// PlannerTab Component
export default function PlannerTab({ recipes = [], role, canEdit = true, isInitializing = false }) {
  const [plannerData, setPlannerData] = useState({});
  const [activeDietCounts, setActiveDietCounts] = useState({ halal: 0, vegan: 0, kosher: 0, vegetarian: 0 });
  const [menuWeeks, setMenuWeeks] = useState([]);
  const [customStartDate, setCustomStartDate] = useState(() => getMadridTodayStr());
  const [customEndDate, setCustomEndDate] = useState(() => {
    const today = getMadridTodayDateObject();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const dtf = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return dtf.format(nextWeek);
  });
  const [plannerSettings, setPlannerSettings] = useState(() => PLANNER_RULES.getSettings());
  const [inventory, setInventory] = useState([]);
  const [selectedWeeks, setSelectedWeeks] = useState(() => {
    const today = getMadridTodayDateObject();
    const wk = Math.min(4, Math.ceil(today.getDate() / 7));
    return [wk];
  });
  const [viewMode, setViewMode] = useState('week'); // 'day' | 'week' | 'month'
  const [comensalesList, setComensalesList] = useState([]);
  const [logs, setLogs] = useState([
    { type: 'info', msg: '[SISTEMA] Consola iniciada. Esperando eventos...', ts: new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' }) }
  ]);
  const [loading, setLoading] = useState(false);
  const [weeklyPlayers, setWeeklyPlayers] = useState(() => {
    const stored = localStorage.getItem('acfc_weekly_players_v2');
    if (stored) {
      try { return JSON.parse(stored); } catch (e) { /* fallback */ }
    }
    return {};
  });

  const handleUpdateMealPlayers = (weekKey, mealType, delta) => {
    setWeeklyPlayers(prev => {
      const currentWeekObj = prev[weekKey] || { lunch: 25, dinner: 20 };
      const currentVal = currentWeekObj[mealType] !== undefined ? currentWeekObj[mealType] : (mealType === 'lunch' ? 25 : 20);
      const nextVal = Math.max(1, currentVal + delta);
      const updated = { 
        ...prev, 
        [weekKey]: { 
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
  const [selectedDayMonth, setSelectedDayMonth] = useState(null);
  const [selectedDayYear, setSelectedDayYear] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'success' | 'error'
  const [generalSaveStatus, setGeneralSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'success' | 'error'
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [shoppingModalOpen, setShoppingModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [comensalesModalOpen, setComensalesModalOpen] = useState(false);
  const [baseComensalesModalOpen, setBaseComensalesModalOpen] = useState(false);

  // Day Form State
  const [dayForm, setDayForm] = useState({
    breakfast_recipe_id: '',
    lunch_recipe_id: '',
    lunch_side_recipe_id: '',
    dinner_recipe_id: '',
    breakfast_players: 0,
    breakfast_halal: 0,
    breakfast_kosher: 0,
    breakfast_vegan: 0,
    breakfast_allergies: '',
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

  const [baseComensalesForm, setBaseComensalesForm] = useState({
    breakfast_players: 20,
    breakfast_halal: 0,
    breakfast_kosher: 0,
    breakfast_vegan: 0,
    breakfast_allergies: '',
    lunch_players: 25,
    lunch_halal: 0,
    lunch_kosher: 0,
    lunch_vegan: 0,
    lunch_allergies: '',
    dinner_players: 20,
    dinner_halal: 0,
    dinner_kosher: 0,
    dinner_vegan: 0,
    dinner_allergies: ''
  });

  const addLog = useCallback((msg, type = 'info') => {
    const ts = new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' });
    setLogs(prev => [...prev, { type, msg, ts }].slice(-300));
    console.log(`[PlannerAudit] [${type.toUpperCase()}] ${msg}`);
  }, []);

  const [currentDate, setCurrentDate] = useState(() => getMadridTodayDateObject()); // Default: Current system date

  // ── Calcular desglose reactivo de comensales visibles en pantalla por servicio ──
  const visibleComensalesBreakdown = useMemo(() => {
    let breakfast = 0;
    let lunch = 0;
    let dinner = 0;
    let visibleDates = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'day') {
      const activeDayNum = selectedDay || getMadridTodayDateObject().getDate();
      visibleDates = [`${year}-${String(month + 1).padStart(2, '0')}-${String(activeDayNum).padStart(2, '0')}`];
    } else if (viewMode === 'week') {
      selectedWeeks.forEach(w => {
        const weekDaysList = getMadridWeekRange(year, month, w);
        weekDaysList.forEach(d => {
          if (d?.dateStr) visibleDates.push(d.dateStr);
        });
      });
    } else if (viewMode === 'range') {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        let curr = new Date(start);
        while (curr <= end) {
          const iso = curr.toISOString().split('T')[0];
          visibleDates.push(iso);
          curr.setDate(curr.getDate() + 1);
        }
      }
    } else {
      // viewMode === 'month'
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        visibleDates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }

    visibleDates.forEach(date => {
      const dayData = plannerData[date] || {};
      breakfast += Number(dayData.breakfast_players) || 0;
      lunch += Number(dayData.lunch_players) || 0;
      dinner += Number(dayData.dinner_players) || 0;
    });

    return { breakfast, lunch, dinner };
  }, [plannerData, selectedWeeks, currentDate, viewMode, selectedDay, customStartDate, customEndDate]);

  const openBaseComensalesModal = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const weekNum = selectedWeeks[0] || 1;
    const weekDaysList = getMadridWeekRange(year, month, weekNum);
    const weekMondayStr = weekDaysList[0]?.dateStr || '';
    const currentWeekPlayers = weeklyPlayers[weekMondayStr] || { lunch: 25, dinner: 20, breakfast: 20 };
    
    let baseHalalLunch = 0;
    let baseKosherLunch = 0;
    let baseVeganLunch = 0;
    let baseAllergiesLunch = '';
    
    let baseHalalDinner = 0;
    let baseKosherDinner = 0;
    let baseVeganDinner = 0;
    let baseAllergiesDinner = '';

    let baseHalalBreakfast = 0;
    let baseKosherBreakfast = 0;
    let baseVeganBreakfast = 0;
    let baseAllergiesBreakfast = '';

    weekDaysList.forEach(({ dateStr }) => {
      const dayData = plannerData[dateStr];
      if (dayData) {
        if (dayData.lunch_halal) baseHalalLunch = dayData.lunch_halal;
        if (dayData.lunch_kosher) baseKosherLunch = dayData.lunch_kosher;
        if (dayData.lunch_vegan) baseVeganLunch = dayData.lunch_vegan;
        if (dayData.lunch_allergies) {
          const cleaned = dayData.lunch_allergies.replace(/\s*\[manual\]/g, '').replace(/^\[manual\]/g, '');
          if (cleaned) baseAllergiesLunch = cleaned;
        }

        if (dayData.dinner_halal) baseHalalDinner = dayData.dinner_halal;
        if (dayData.dinner_kosher) baseKosherDinner = dayData.dinner_kosher;
        if (dayData.dinner_vegan) baseVeganDinner = dayData.dinner_vegan;
        if (dayData.dinner_allergies) baseAllergiesDinner = dayData.dinner_allergies;

        if (dayData.breakfast_halal) baseHalalBreakfast = dayData.breakfast_halal;
        if (dayData.breakfast_kosher) baseKosherBreakfast = dayData.breakfast_kosher;
        if (dayData.breakfast_vegan) baseVeganBreakfast = dayData.breakfast_vegan;
        if (dayData.breakfast_allergies) baseAllergiesBreakfast = dayData.breakfast_allergies;
      }
    });

    setBaseComensalesForm({
      breakfast_players: currentWeekPlayers.breakfast ?? 20,
      breakfast_halal: baseHalalBreakfast,
      breakfast_kosher: baseKosherBreakfast,
      breakfast_vegan: baseVeganBreakfast,
      breakfast_allergies: baseAllergiesBreakfast,
      lunch_players: currentWeekPlayers.lunch ?? 25,
      lunch_halal: baseHalalLunch,
      lunch_kosher: baseKosherLunch,
      lunch_vegan: baseVeganLunch,
      lunch_allergies: baseAllergiesLunch,
      dinner_players: currentWeekPlayers.dinner ?? 20,
      dinner_halal: baseHalalDinner,
      dinner_kosher: baseKosherDinner,
      dinner_vegan: baseVeganDinner,
      dinner_allergies: baseAllergiesDinner
    });
    
    setBaseComensalesModalOpen(true);
  };

  const getActiveRestrictions = useCallback((playersCount) => {
    if (!comensalesList || comensalesList.length === 0) {
      return { halal: 0, kosher: 0, vegan: 0, allergies: '' };
    }
    const activos = comensalesList.filter(c => c.activo !== false);
    
    const halal = activos.filter(c => (c.dieta || '').toLowerCase().trim() === 'halal').length;
    const kosher = activos.filter(c => (c.dieta || '').toLowerCase().trim() === 'kosher').length;
    const vegan = activos.filter(c => (c.dieta || '').toLowerCase().trim() === 'vegano' || (c.dieta || '').toLowerCase().trim() === 'vegan').length;
    
    const allAllergies = activos
      .map(c => (c.alergias || '').trim())
      .filter(Boolean)
      .flatMap(a => a.split(',').map(s => s.trim().toLowerCase()))
      .filter(Boolean);
    
    const uniqueAllergies = [...new Set(allAllergies)]
      .map(a => a.charAt(0).toUpperCase() + a.slice(1));
    
    const allergiesStr = uniqueAllergies.join(', ');
    
    return {
      halal: Math.min(playersCount, halal),
      kosher: Math.min(playersCount, kosher),
      vegan: Math.min(playersCount, vegan),
      allergies: allergiesStr
    };
  }, [comensalesList]);

  const [weeklySummaryOpen, setWeeklySummaryOpen] = useState(true);

  const weeklyOperationalBreakdown = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const weekNum = selectedWeeks[0] || 1;
    const weekDaysList = getMadridWeekRange(year, month, weekNum);

    return weekDaysList.map(({ dateStr, label, dayNum }) => {
      const menu = plannerData[dateStr] || {};
      
      const bPlayers = Number(menu.breakfast_players) || 0;
      const lPlayers = Number(menu.lunch_players) || 0;
      const dPlayers = Number(menu.dinner_players) || 0;

      const bRest = getActiveRestrictions(bPlayers);
      const lRest = getActiveRestrictions(lPlayers);
      const dRest = getActiveRestrictions(dPlayers);

      return {
        dateStr,
        label,
        dayNum,
        confirmado: !!menu.confirmado,
        breakfast: { players: bPlayers, ...bRest },
        lunch: { players: lPlayers, ...lRest },
        dinner: { players: dPlayers, ...dRest }
      };
    });
  }, [plannerData, selectedWeeks, currentDate, getActiveRestrictions]);

  const maxWeeklyPlayers = useMemo(() => {
    let max = 0;
    weeklyOperationalBreakdown.forEach(day => {
      max = Math.max(max, day.breakfast.players, day.lunch.players, day.dinner.players);
    });
    return max || 0;
  }, [weeklyOperationalBreakdown]);

  const handleApplyWeeklyComensales = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const weekNum = selectedWeeks[0] || 1;
    const weekDaysList = getMadridWeekRange(year, month, weekNum);
    
    addLog(`Aplicando comensales base a la semana ${weekNum}...`, 'info');
    
    try {
      const daysToSave = [];
      const confirmedDaysToSave = [];
      const newPlannerData = { ...plannerData };

      const bPlayers = Number(baseComensalesForm.breakfast_players) || 0;
      const lPlayers = Number(baseComensalesForm.lunch_players) || 0;
      const dPlayers = Number(baseComensalesForm.dinner_players) || 0;

      const bRest = getActiveRestrictions(bPlayers);
      const lRest = getActiveRestrictions(lPlayers);
      const dRest = getActiveRestrictions(dPlayers);
      
      weekDaysList.forEach(({ dateStr }) => {
        const existing = plannerData[dateStr] || {};
        
        // Si el día ya está personalizado manualmente ([manual]), lo respetamos por completo
        if (existing.lunch_allergies?.includes('[manual]')) {
          return;
        }
        
        const updatedDay = {
          ...existing,
          date: dateStr,
          breakfast_recipe_id: existing.breakfast_recipe_id || existing.breakfast_recipe || null,
          lunch_recipe_id: existing.lunch_recipe_id || existing.lunch_recipe || null,
          lunch_side_recipe_id: existing.lunch_side_recipe_id || existing.lunch_side_recipe || null,
          dinner_recipe_id: existing.dinner_recipe_id || existing.dinner_recipe || null,
          breakfast_players: bPlayers,
          breakfast_halal: bRest.halal,
          breakfast_kosher: bRest.kosher,
          breakfast_vegan: bRest.vegan,
          breakfast_allergies: bRest.allergies,
          lunch_players: lPlayers,
          lunch_halal: lRest.halal,
          lunch_kosher: lRest.kosher,
          lunch_vegan: lRest.vegan,
          lunch_allergies: lRest.allergies,
          dinner_players: dPlayers,
          dinner_halal: dRest.halal,
          dinner_kosher: dRest.kosher,
          dinner_vegan: dRest.vegan,
          dinner_allergies: dRest.allergies,
        };
        
        newPlannerData[dateStr] = updatedDay;
        
        if (existing.confirmado) {
          confirmedDaysToSave.push({ ...updatedDay, confirmado: true });
        } else {
          daysToSave.push(updatedDay);
        }
      });
      
      // Persistencia atómica en Supabase
      if (daysToSave.length > 0) {
        const { error } = await api.guardarMenuBorrador(daysToSave);
        if (error) throw error;
      }
      
      if (confirmedDaysToSave.length > 0) {
        const { error } = await api.guardarYConfirmarMenu(confirmedDaysToSave);
        if (error) throw error;
      }
      
      // Actualizar estado frontend
      setPlannerData(newPlannerData);
      
      // Actualizar weeklyPlayers para coherencia del generador semanal
      const weekMondayStr = weekDaysList[0].dateStr;
      setWeeklyPlayers(prev => {
        const updated = {
          ...prev,
          [weekMondayStr]: {
            lunch: lPlayers,
            dinner: dPlayers,
            breakfast: bPlayers
          }
        };
        localStorage.setItem('acfc_weekly_players_v2', JSON.stringify(updated));
        return updated;
      });
      
      addLog(`Comensales base aplicados con éxito a la semana ${weekNum}`, 'success');
      if (typeof window.toast === 'function') {
        window.toast(`✅ Comensales base aplicados a la semana ${weekNum}`);
      }
      
      setBaseComensalesModalOpen(false);
      loadData();
    } catch (err) {
      addLog(`Error al aplicar comensales base: ${err.message}`, 'error');
      if (typeof window.toast === 'function') {
        window.toast(`❌ Error: ${err.message}`);
      }
    }
  };

  const goToCurrentWeek = () => {
    const today = getMadridTodayDateObject();
    setCurrentDate(today);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstWeekdayIndex = getMadridWeekdayIndexForDate(firstOfMonth);
    const wk = Math.ceil((today.getDate() + firstWeekdayIndex) / 7);
    setSelectedWeeks([wk]);
    setSelectedDay(today.getDate());
  };

  const handlePrevMonth = () => {
    if (viewMode === 'week') {
      setSelectedWeeks(prev => {
        const currentW = prev[0] || 1;
        if (currentW > 1) {
          return [currentW - 1];
        } else {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const prevMonthDate = new Date(year, month - 1, 1);
          const maxWeeks = getMadridWeeksInMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
          setCurrentDate(prevMonthDate);
          return [maxWeeks];
        }
      });
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNextMonth = () => {
    if (viewMode === 'week') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const numWeeks = getMadridWeeksInMonth(year, month);
      setSelectedWeeks(prev => {
        const currentW = prev[0] || 1;
        if (currentW < numWeeks) {
          return [currentW + 1];
        } else {
          setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
          return [1];
        }
      });
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  // Force current week when entering weekly view
  useEffect(() => {
    if (viewMode === 'week') {
      const today = getMadridTodayDateObject();
      if (currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() === today.getMonth()) {
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstWeekdayIndex = getMadridWeekdayIndexForDate(firstOfMonth);
        const wk = Math.ceil((today.getDate() + firstWeekdayIndex) / 7);
        setSelectedWeeks([wk]);
      }
    }
  }, [viewMode]);

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

      // Calculate calendar start & end boundaries in Madrid timezone
      let startDate, endDate;
      if (viewMode === 'range') {
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const numWeeks = getMadridWeeksInMonth(year, month);
        const firstWeekDays = getMadridWeekRange(year, month, 1);
        const lastWeekDays = getMadridWeekRange(year, month, numWeeks);
        startDate = firstWeekDays[0].dateStr;
        endDate = lastWeekDays[6].dateStr;
      }

      const [plannerRes, ingredientsRes, weeksRes, comensalesRes] = await Promise.all([
        api.fetchPlannerDataDb(startDate, endDate),
        api.fetchIngredients(),
        api.fetchMenuWeeks(),
        api.fetchComensales()
      ]);

      if (plannerRes.error) throw plannerRes.error;
      if (ingredientsRes.error) throw ingredientsRes.error;
      if (weeksRes.error) throw weeksRes.error;
      if (comensalesRes.error) throw comensalesRes.error;
      
      let halal = 0, vegan = 0, kosher = 0, vegetarian = 0;
      if (comensalesRes.data) {
        setComensalesList(comensalesRes.data);
        comensalesRes.data.forEach(c => {
          if (c.activo !== false) {
            const d = (c.dieta || '').toLowerCase().trim();
            if (d.includes('halal')) halal++;
            if (d.includes('vegan')) vegan++;
            if (d.includes('kosher')) kosher++;
            if (d.includes('veget') || d.includes('vegan')) vegetarian++;
          }
        });
      }
      setActiveDietCounts({ halal, vegan, kosher, vegetarian });

      const plannerMap = {};
      if (plannerRes.data) {
        plannerRes.data.forEach(row => {
          if (row.date) {
            // Indexar por ISO 'YYYY-MM-DD'
            plannerMap[row.date] = row;
          }
        });
      }
      setPlannerData(plannerMap);
      window.PLANNER_DATA = plannerMap;
      
      const invData = ingredientsRes.data || [];
      setInventory(invData);
      window.INVENTORY = invData;

      const wData = weeksRes.data || [];
      setMenuWeeks(wData);
      window.MENU_WEEKS = wData;

      addLog(`Planificación e inventario cargados con éxito para el rango ${startDate} a ${endDate}`, 'success');
    } catch (e) {
      addLog(`Error al cargar datos desde Supabase: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addLog, currentDate, viewMode, customStartDate, customEndDate]);

  useEffect(() => {
    if (isInitializing) return;
    loadData();
    window.refreshReactPlanner = loadData;
    window.addPlannerAuditLog = (msg, type = 'info') => addLog(msg, type);
    window.openPlannerDayModal = (day) => openDayEditor(day);
    return () => {
      window.refreshReactPlanner = null;
      window.addPlannerAuditLog = null;
      window.openPlannerDayModal = null;
    };
  }, [loadData, addLog, isInitializing]);

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
        const rYear = selectedDayYear !== null ? selectedDayYear : year;
        const rMonth = selectedDayMonth !== null ? selectedDayMonth : month;
        const dateISO = `${rYear}-${String(rMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        datesToReset = [dateISO];
      } else if (resetScope === 'week') {
        if (!selectedWeeks || selectedWeeks.length === 0) {
          if (typeof window.toast === 'function') window.toast('⚠️ No hay ninguna semana activa en el filtro');
          return;
        }
        // Calculate days belonging to selected weeks in current month
        selectedWeeks.forEach(w => {
          const weekDaysList = getMadridWeekRange(year, month, w);
          weekDaysList.forEach(({ dateStr }) => {
            datesToReset.push(dateStr);
          });
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

  const handleClearDay = (day, optMonth, optYear) => {
    setSelectedDay(day);
    setSelectedDayMonth(optMonth !== undefined ? optMonth : currentDate.getMonth());
    setSelectedDayYear(optYear !== undefined ? optYear : currentDate.getFullYear());
    setResetScope('day');
    setResetModalOpen(true);
  };

  const sanitizeRecipeId = (id) => {
    if (!id || String(id).trim() === '') return null;
    const exists = recipes.some(r => r.id === id);
    return exists ? id : null;
  };

  const handleSaveDay = async () => {
    if (!selectedDay) return;
    const year = selectedDayYear !== null ? selectedDayYear : currentDate.getFullYear();
    const month = selectedDayMonth !== null ? selectedDayMonth : currentDate.getMonth();
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    addLog(`Guardando día ${selectedDay} (${formattedDate})...`, 'info');
    setSaveStatus('saving');
    try {
      const bPlayers = Number(dayForm.breakfast_players) || 0;
      const lPlayers = Number(dayForm.lunch_players) || 0;
      const dPlayers = Number(dayForm.dinner_players) || 0;

      const bRest = getActiveRestrictions(bPlayers);
      const lRest = getActiveRestrictions(lPlayers);
      const dRest = getActiveRestrictions(dPlayers);

      // Añadir marca de manual a lunch_allergies si no existe
      let finalLunchAllergies = lRest.allergies || '';
      if (!finalLunchAllergies.includes('[manual]')) {
        finalLunchAllergies = finalLunchAllergies ? `${finalLunchAllergies} [manual]` : '[manual]';
      }

      const payload = {
        date: formattedDate,
        breakfast_recipe_id: sanitizeRecipeId(dayForm.breakfast_recipe_id),
        lunch_recipe_id: sanitizeRecipeId(dayForm.lunch_recipe_id),
        lunch_side_recipe_id: sanitizeRecipeId(dayForm.lunch_side_recipe_id),
        dinner_recipe_id: sanitizeRecipeId(dayForm.dinner_recipe_id),
        breakfast_players: bPlayers,
        breakfast_halal: bRest.halal,
        breakfast_kosher: bRest.kosher,
        breakfast_vegan: bRest.vegan,
        breakfast_allergies: bRest.allergies,
        lunch_players: lPlayers,
        lunch_halal: lRest.halal,
        lunch_kosher: lRest.kosher,
        lunch_vegan: lRest.vegan,
        lunch_allergies: finalLunchAllergies,
        dinner_players: dPlayers,
        dinner_halal: dRest.halal,
        dinner_kosher: dRest.kosher,
        dinner_vegan: dRest.vegan,
        dinner_allergies: dRest.allergies
      };
      
      console.log('Depurando objeto a guardar:', payload);
      
      const dayData = plannerData[formattedDate] || {};
      let saveResult;
      if (dayData.confirmado) {
        saveResult = await api.guardarYConfirmarMenu([{ ...payload, confirmado: true }]);
      } else {
        saveResult = await api.guardarMenuBorrador([payload]);
      }
      if (saveResult && saveResult.error) throw saveResult.error;

      // Actualizar estado local inmediatamente para refrescar la tarjeta visual al instante
      setPlannerData(prev => {
        const nextMap = { ...prev };
        nextMap[formattedDate] = { ...nextMap[formattedDate], ...payload };
        return nextMap;
      });
      
      setSaveStatus('success');
      addLog(`Día ${selectedDay} guardado con éxito`, 'success');
      if (typeof window.toast === 'function') {
        window.toast(`✅ Día ${selectedDay} guardado con éxito`);
      }
      
      setTimeout(() => {
        setDayModalOpen(false);
        setSaveStatus('idle');
        loadData();
      }, 1500);
    } catch (e) {
      setSaveStatus('error');
      addLog(`Error al guardar día ${selectedDay}: ${e.message}`, 'error');
      if (typeof window.toast === 'function') {
        window.toast(`❌ Error al guardar: ${e.message}`);
      }
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  };

  const openDayEditor = (day, optMonth, optYear) => {
    setSelectedDay(day);
    const year = optYear !== undefined ? optYear : currentDate.getFullYear();
    const month = optMonth !== undefined ? optMonth : currentDate.getMonth();
    setSelectedDayMonth(month);
    setSelectedDayYear(year);
    const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Search plannerData using ISO date string
    const dayData = plannerData[dateISO] || {};
    
    const savedSideId = dayData.lunch_side_recipe_id || dayData.lunch_side_recipe?.id || '';

    // Limpiar flag manual de lunch_allergies
    let displayLunchAllergies = dayData.lunch_allergies || '';
    displayLunchAllergies = displayLunchAllergies.replace(/\s*\[manual\]/g, '').replace(/^\[manual\]/g, '');

    setDayForm({
      breakfast_recipe_id: dayData.breakfast_recipe_id || '',
      lunch_recipe_id: dayData.lunch_recipe_id || '',
      lunch_side_recipe_id: savedSideId,
      dinner_recipe_id: dayData.dinner_recipe_id || '',
      breakfast_players: dayData.breakfast_players || 20,
      breakfast_halal: dayData.breakfast_halal || 0,
      breakfast_kosher: dayData.breakfast_kosher || 0,
      breakfast_vegan: dayData.breakfast_vegan || 0,
      breakfast_allergies: dayData.breakfast_allergies || '',
      lunch_players: dayData.lunch_players || 25,
      lunch_halal: dayData.lunch_halal || 0,
      lunch_kosher: dayData.lunch_kosher || 0,
      lunch_vegan: dayData.lunch_vegan || 0,
      lunch_allergies: displayLunchAllergies,
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

  const getVegAlternative = useCallback((id) => {
    if (!id) return null;
    const base = recipes.find(rec => rec.id === id);
    if (!base) return null;
    if (base.equivalent_recipe_id) {
      return recipes.find(rec => rec.id === base.equivalent_recipe_id) || null;
    }
    return recipes.find(rec => rec.name === `${base.name} (vegetarian)` || rec.name === `${base.name} (Vegetarian)`) || null;
  }, [recipes]);

  const getLunchPlayers = useCallback((menu, dateStr) => {
    if (menu?.lunch_players) return menu.lunch_players;
    if (!dateStr) return 25;
    const weekMondayStr = getMadridMondayOfWeek(dateStr);
    return weeklyPlayers[weekMondayStr]?.lunch || 25;
  }, [weeklyPlayers]);

  const getDinnerPlayers = useCallback((menu, dateStr) => {
    if (menu?.dinner_players) return menu.dinner_players;
    if (!dateStr) return 20;
    const weekMondayStr = getMadridMondayOfWeek(dateStr);
    return weeklyPlayers[weekMondayStr]?.dinner || 20;
  }, [weeklyPlayers]);

  const renderVegIndicator = (baseId, mealPlayers) => {
    const vegRecipe = getVegAlternative(baseId);
    if (!vegRecipe || activeDietCounts.vegetarian <= 0) return null;
    const vegCount = Math.min(mealPlayers, activeDietCounts.vegetarian);
    if (vegCount <= 0) return null;
    
    return (
      <div className="group relative flex items-center justify-center">
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 shadow-sm cursor-help">
          <span className="text-[10px] leading-none">🍃</span>
          <span className="text-[9px] font-bold leading-none">Veg</span>
        </div>
        <div className="absolute bottom-full right-[-10px] md:left-1/2 md:-translate-x-1/2 mb-2 w-max max-w-[220px] bg-slate-900 text-white text-[11px] rounded-lg p-2.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[9999] shadow-xl border border-slate-700 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 mb-0.5 border-b border-slate-700 pb-1">
            <span className="text-emerald-400">🍃</span>
            <span className="font-bold text-emerald-400 uppercase tracking-wide text-[9px]">Opción Veg</span>
          </div>
          <p className="font-semibold text-slate-100 whitespace-normal text-left">{vegRecipe.name}</p>
          <p className="text-emerald-300 font-medium text-[10px] text-left">{vegCount} comensales (confirmados)</p>
          {/* Arrow */}
          <div className="absolute top-full right-[16px] md:left-1/2 md:-translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
        </div>
      </div>
    );
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
        const weekDaysList = getMadridWeekRange(year, month, week);
        const weekMondayStr = weekDaysList[0].dateStr;
        
        // Find if this week is confirmed in menu_weeks
        const isConfirmedWeek = (menuWeeks || []).some(w => w.start_date === weekMondayStr && w.confirmado === true);
        
        // Regla de Protección contra Sobrescritura:
        const hasExistingMenu = weekDaysList.some(({ dateStr }) => {
          const existing = plannerData[dateStr];
          return existing && (existing.lunch_recipe_id || existing.dinner_recipe_id || existing.breakfast_recipe_id);
        });

        if (isConfirmedWeek || hasExistingMenu) {
          const rangeLabel = getMadridWeekRangeLabelForSelector(year, month, week);
          const reason = isConfirmedWeek ? 'está confirmada' : 'ya tiene menús registrados';
          addLog(`⚠️ Omitida generación para la semana [${rangeLabel}]: ${reason}`, 'warn');
          if (typeof window.toast === 'function') {
            window.toast(`⚠️ Semana [${rangeLabel}] omitida: ${reason}`);
          }
          return;
        }

        const weeklyUsedRecipeIds = new Set();
        const breakfastId = sanitizeRecipeId('d9b736b4-2db2-4809-913a-c80f4f81c944');
        if (breakfastId) {
          weeklyUsedRecipeIds.add(breakfastId);
        }

        weekDaysList.forEach(({ dateStr, dayNum, dayLabel }, offset) => {
          const isWeekend = (offset === 5 || offset === 6);
          const dateISO = dateStr;

          // ── EVALUACIÓN PASO A PASO: ALMUERZO ──
          let lunchRecipe = null;
          const shuffledMainsForLunch = shuffleArray(mainRecipes);

          for (const candidate of shuffledMainsForLunch) {
            if (settings['menu_setting_no_repetir_semana'] && weeklyUsedRecipeIds.has(candidate.id)) {
              continue;
            }
            const check = PLANNER_RULES.isRecipeValid(candidate, recentRecipeIds, settings, isWeekend, 'lunch');
            if (check.valid) {
              lunchRecipe = candidate;
              break;
            }
          }

          if (!lunchRecipe) {
            // Fallback to any main recipe not recently served if strict rules exclude all
            lunchRecipe = shuffledMainsForLunch.find(r => {
              if (settings['menu_setting_no_repetir_semana'] && weeklyUsedRecipeIds.has(r.id)) return false;
              return !recentRecipeIds.slice(-5).includes(r.id);
            }) || shuffledMainsForLunch.find(r => !settings['menu_setting_no_repetir_semana'] || !weeklyUsedRecipeIds.has(r.id)) || shuffledMainsForLunch[0] || null;
          }

          const randLunch = lunchRecipe?.id || null;
          if (randLunch) {
            recentRecipeIds.push(randLunch);
            weeklyUsedRecipeIds.add(randLunch);
          }

          // ── EVALUACIÓN PASO A PASO: GUARNICIÓN ──
          let randSide = null;
          if (settings['menu_setting_incluir_guarniciones'] !== false) {
            const shuffledSides = shuffleArray(sideRecipes);
            
            // Inicializar mapa de uso por semana si no existe
            if (!weekSideCounts[week]) weekSideCounts[week] = {};

            // Filtrar guarniciones válidas:
            // 1. Que no se hayan servido el día inmediatamente anterior (no consecutivas)
            // 2. Que no superen el máximo de 2 repeticiones en la misma semana (o 1 si repetir_semana es activo)
            const allowedSides = shuffledSides.filter(candidate => {
              if (settings['menu_setting_no_repetir_semana'] && weeklyUsedRecipeIds.has(candidate.id)) {
                return false;
              }
              const countInWeek = weekSideCounts[week][candidate.id] || 0;
              const wasServedYesterday = recentSideIds.length > 0 && recentSideIds[recentSideIds.length - 1] === candidate.id;
              const check = PLANNER_RULES.isRecipeValid(candidate, [], settings, isWeekend, 'lunch_side');
              const maxAllowed = settings['menu_setting_no_repetir_semana'] ? 1 : 2;
              return check.valid && !wasServedYesterday && countInWeek < maxAllowed;
            });

            if (allowedSides.length > 0) {
              randSide = allowedSides[0].id;
            } else if (sideRecipes.length > 0) {
              // Fallback: seleccionar cualquier guarnición no servida ayer
              const fallbackSide = shuffledSides.find(s => {
                if (settings['menu_setting_no_repetir_semana'] && weeklyUsedRecipeIds.has(s.id)) return false;
                return recentSideIds.length === 0 || recentSideIds[recentSideIds.length - 1] !== s.id;
              }) || shuffledSides.find(s => !settings['menu_setting_no_repetir_semana'] || !weeklyUsedRecipeIds.has(s.id)) || shuffledSides[0];
              randSide = fallbackSide?.id || null;
            }

            if (randSide) {
              recentRecipeIds.push(randSide);
              recentSideIds.push(randSide);
              weeklyUsedRecipeIds.add(randSide);
              weekSideCounts[week][randSide] = (weekSideCounts[week][randSide] || 0) + 1;
            }
          }

          // ── EVALUACIÓN PASO A PASO: CENA ──
          let dinnerRecipe = null;
          const shuffledMainsForDinner = shuffleArray(mainRecipes);

          for (const candidate of shuffledMainsForDinner) {
            if (settings['menu_setting_no_repetir_semana'] && weeklyUsedRecipeIds.has(candidate.id)) {
              continue;
            }
            const check = PLANNER_RULES.isRecipeValid(candidate, recentRecipeIds, settings, isWeekend, 'dinner', lunchRecipe);
            if (check.valid) {
              dinnerRecipe = candidate;
              break;
            }
          }

          if (!dinnerRecipe) {
            dinnerRecipe = shuffledMainsForDinner.find(r => {
              if (settings['menu_setting_no_repetir_semana'] && weeklyUsedRecipeIds.has(r.id)) return false;
              return r.id !== randLunch && !recentRecipeIds.slice(-5).includes(r.id);
            }) || shuffledMainsForDinner.find(r => !settings['menu_setting_no_repetir_semana'] || !weeklyUsedRecipeIds.has(r.id)) || shuffledMainsForDinner[0] || null;
          }

          const randDinner = dinnerRecipe?.id || null;
          if (randDinner) {
            recentRecipeIds.push(randDinner);
            weeklyUsedRecipeIds.add(randDinner);
          }

          // Mantener cola de rotación amplia (últimos 14 platos servidos)
          if (recentRecipeIds.length > 14) {
            recentRecipeIds = recentRecipeIds.slice(-14);
          }

          // Número de comensales asignado específicamente a esta semana (Comida y Cena independientes)
          const weekMondayStr = weekDaysList[0].dateStr;
          const weekLunchPlayers = Number(weeklyPlayers[weekMondayStr]?.lunch) || defaultLunchPlayers;
          const weekDinnerPlayers = Number(weeklyPlayers[weekMondayStr]?.dinner) || defaultDinnerPlayers;

          const weekBreakfastPlayers = Number(weeklyPlayers[weekMondayStr]?.breakfast) || 20;

          const existingDayData = plannerData[dateISO] || {};
          const isManual = existingDayData.lunch_allergies?.includes('[manual]');

          upserts.push({
            date: dateISO,
            breakfast_recipe_id: sanitizeRecipeId('d9b736b4-2db2-4809-913a-c80f4f81c944'),
            lunch_recipe_id: randLunch,
            lunch_side_recipe_id: randSide,
            dinner_recipe_id: randDinner,
            breakfast_players: isManual ? (Number(existingDayData.breakfast_players) || weekBreakfastPlayers) : weekBreakfastPlayers,
            breakfast_halal: isManual ? (Number(existingDayData.breakfast_halal) || 0) : 0,
            breakfast_kosher: isManual ? (Number(existingDayData.breakfast_kosher) || 0) : 0,
            breakfast_vegan: isManual ? (Number(existingDayData.breakfast_vegan) || 0) : 0,
            breakfast_allergies: isManual ? (existingDayData.breakfast_allergies || '') : '',
            lunch_players: isManual ? (Number(existingDayData.lunch_players) || weekLunchPlayers) : weekLunchPlayers,
            lunch_halal: isManual ? (Number(existingDayData.lunch_halal) || 0) : 0,
            lunch_kosher: isManual ? (Number(existingDayData.lunch_kosher) || 0) : 0,
            lunch_vegan: isManual ? (Number(existingDayData.lunch_vegan) || 0) : 0,
            lunch_allergies: isManual ? (existingDayData.lunch_allergies || '1 Celíaco') : '1 Celíaco',
            dinner_players: isManual ? (Number(existingDayData.dinner_players) || weekDinnerPlayers) : weekDinnerPlayers,
            dinner_halal: isManual ? (Number(existingDayData.dinner_halal) || 0) : 0,
            dinner_kosher: isManual ? (Number(existingDayData.dinner_kosher) || 0) : 0,
            dinner_vegan: isManual ? (Number(existingDayData.dinner_vegan) || 0) : 0,
            dinner_allergies: isManual ? (existingDayData.dinner_allergies || '') : ''
          });
        });
      });

      const { error } = await api.guardarMenuBorrador(upserts);
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
    setGeneralSaveStatus('saving');
    try {
      const menuDays = Object.values(plannerData);
      if (menuDays.length === 0) {
        addLog('No hay días planificados para confirmar', 'warn');
        setGeneralSaveStatus('idle');
        return;
      }
      const { error } = await api.guardarYConfirmarMenu(menuDays);
      if (error) throw error;
      
      addLog('¡Inventario reservado y menú semanal confirmado con éxito!', 'success');
      if (typeof window.toast === 'function') {
        window.toast('🟢 ¡Inventario reservado y menú semanal confirmado con éxito!');
      }
      setGeneralSaveStatus('success');
      loadData();
      
      setTimeout(() => {
        setGeneralSaveStatus('idle');
      }, 2000);
    } catch (e) {
      addLog(`Error al guardar y confirmar stock: ${e.message}`, 'error');
      if (typeof window.toast === 'function') {
        window.toast(`🔴 Error: ${e.message}`);
      }
      setGeneralSaveStatus('error');
      setTimeout(() => {
        setGeneralSaveStatus('idle');
      }, 2000);
    } finally {
      // Safety net: if somehow status is still 'saving' after 10s, unblock the button
      setTimeout(() => {
        setGeneralSaveStatus(prev => prev === 'saving' ? 'idle' : prev);
      }, 10000);
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
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
          
          {/* View Mode Selector (Día | Semana | Mes | Rango) */}
          <div className="col-span-2 sm:col-span-1 flex items-center justify-center bg-slate-200/80 p-0.5 rounded-xl border border-slate-300">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'day' ? 'bg-brand text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Día
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'week' ? 'bg-brand text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'month' ? 'bg-brand text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setViewMode('range')}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'range' ? 'bg-brand text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rango
            </button>
          </div>

          {/* Reset button */}
          {canEdit && (
            <button 
              onClick={() => setResetModalOpen(true)}
              className="border border-red-200 text-red-600 bg-white hover:bg-red-50 font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs whitespace-nowrap"
            >
              <Trash2 size={14} />
              <span>Resetear</span>
            </button>
          )}

          {/* Week selector */}
          {viewMode === 'week' && (
            <div className="flex flex-wrap items-center justify-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5">Semanas:</span>
              {(() => {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const numWeeks = getMadridWeeksInMonth(year, month);
                const weeksArr = [];
                for (let i = 1; i <= numWeeks; i++) weeksArr.push(i);
                return weeksArr.map(w => (
                  <label key={w} className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap">
                    <input 
                      type="checkbox" 
                      checked={selectedWeeks.includes(w)}
                      onChange={() => handleWeekToggle(w)}
                      className="rounded border-slate-300 text-brand focus:ring-brand w-3.5 h-3.5"
                    />
                    <span>{getMadridWeekRangeLabelForSelector(year, month, w)}</span>
                  </label>
                ));
              })()}
            </div>
          )}

          {/* Custom Date Range selector */}
          {viewMode === 'range' && (
            <div className="flex flex-wrap items-center justify-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Inicio:</span>
                <input 
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-755 outline-hidden"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Fin:</span>
                <input 
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-755 outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Quick Weekly Players Controls — Informativo y Reactivo Desglosado */}
          <div className="col-span-2 sm:col-span-1 flex flex-wrap items-center gap-2 bg-indigo-50/80 border border-indigo-200 p-1.5 rounded-xl">
            <div className="flex items-center gap-1">
              <Users size={13} className="text-indigo-600 ml-1" />
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight mr-1">
                Desglose:
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-800 bg-white border border-indigo-100 rounded-lg px-2 py-0.5 shadow-xs" title="Desayunos Totales">
                🍳 {visibleComensalesBreakdown.breakfast}
              </span>
              <span className="text-[10px] font-bold text-slate-800 bg-white border border-indigo-100 rounded-lg px-2 py-0.5 shadow-xs" title="Almuerzos Totales">
                ☀️ {visibleComensalesBreakdown.lunch}
              </span>
              <span className="text-[10px] font-bold text-slate-800 bg-white border border-indigo-100 rounded-lg px-2 py-0.5 shadow-xs" title="Cenas Totales">
                🌙 {visibleComensalesBreakdown.dinner}
              </span>
            </div>
          </div>

          {/* Auto-generate button */}
          {canEdit && (
            <button 
              onClick={handleGenerateWeekly}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-semibold hover:shadow-md transition-all whitespace-nowrap"
            >
              <RefreshCw size={14} className="animate-pulse" />
              <span>Generar Menú</span>
            </button>
          )}

          {/* Save / Reserve Stock button */}
          {canEdit && (
            <button
              onClick={handleSaveAndConfirm}
              disabled={generalSaveStatus === 'saving' || generalSaveStatus === 'success'}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-white rounded-xl text-xs font-semibold hover:shadow-md transition-all whitespace-nowrap cursor-pointer ${
                generalSaveStatus === 'saving' ? 'bg-slate-500 cursor-wait' :
                generalSaveStatus === 'success' ? 'bg-green-600' :
                generalSaveStatus === 'error' ? 'bg-rose-600' :
                'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {generalSaveStatus === 'saving' && (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              )}
              {generalSaveStatus === 'success' && (
                <>
                  <Check size={14} className="scale-110" />
                  <span>¡Guardado!</span>
                </>
              )}
              {generalSaveStatus === 'error' && (
                <>
                  <AlertTriangle size={14} />
                  <span>¡Error!</span>
                </>
              )}
              {generalSaveStatus === 'idle' && (
                <>
                  <Check size={14} />
                  <span>Guardar</span>
                </>
              )}
            </button>
          )}

          {/* Shopping list button */}
          <button 
            onClick={() => setShoppingModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition-all whitespace-nowrap"
          >
            <ShoppingCart size={14} />
            <span>Lista compra</span>
          </button>

          {/* Settings button — only for chef/admin */}
          {canEdit && (
            <button 
              onClick={() => setSettingsModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all whitespace-nowrap"
            >
              <Settings size={14} />
              <span>Ajustes</span>
            </button>
          )}

          {/* Comensales button — only for chef/admin */}
          {canEdit && (
            <button 
              onClick={() => setComensalesModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition-all whitespace-nowrap"
            >
              <Users size={14} />
              <span>Comensales</span>
            </button>
          )}

          {/* Asignar Base Semanal button — only for chef/admin */}
          {canEdit && (
            <button 
              onClick={openBaseComensalesModal}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-muted/20 text-brand border border-brand/20 rounded-xl text-xs font-semibold hover:bg-brand-muted/30 transition-all whitespace-nowrap cursor-pointer"
            >
              <Users size={14} />
              <span>Asignar Base Semanal</span>
            </button>
          )}

          {/* Month Navigator */}
          <div className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1 flex-shrink-0">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer"
              title={viewMode === 'week' ? "Semana anterior" : "Mes anterior"}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToCurrentWeek}
              className="px-2.5 py-1 text-[11px] font-bold text-brand bg-brand-muted/20 border border-brand/20 rounded-lg hover:bg-brand-muted/30 transition-colors"
              title="Ir a hoy / esta semana"
            >
              Hoy
            </button>
            <span className="font-semibold text-slate-700 text-xs px-1 min-w-[70px] text-center">
              {currentDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer"
              title={viewMode === 'week' ? "Semana siguiente" : "Mes siguiente"}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── GRID + DIAGNOSTIC CONSOLE ── */}
      <div className="w-full space-y-4">
        
        {/* Calendar Grid & View Selector */}
        <div className="w-full space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-brand inline-block" /> Hoy
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200 inline-block" /> Planificado
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" /> Sin planificar
              </div>
            </div>

            <span className="font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              Modo: {viewMode === 'day' ? 'Vista por Día' : viewMode === 'week' ? `Semana ${selectedWeeks[0] || 1}` : 'Vista Mensual'}
            </span>
          </div>

          {/* Widget de Resumen Semanal Desglosado */}
          {viewMode === 'week' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="text-brand" size={18} />
                  <span className="font-bold text-slate-800 text-sm" style={{ fontFamily: 'Outfit' }}>
                    Censo & Planificación de Comensales (Semana {selectedWeeks[0] || 1})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-brand bg-brand-muted/20 border border-brand/20 px-2.5 py-1 rounded-lg">
                    Tienes {maxWeeklyPlayers} jugadores asignados para toda la semana
                  </span>
                  <button 
                    onClick={() => setWeeklySummaryOpen(!weeklySummaryOpen)} 
                    className="text-slate-500 hover:text-slate-700 p-1 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                  >
                    <span>{weeklySummaryOpen ? 'Ocultar desglose' : 'Mostrar desglose'}</span>
                    <span className="material-symbols-outlined font-bold" style={{ fontSize: '16px' }}>
                      {weeklySummaryOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                </div>
              </div>

              {weeklySummaryOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2 pt-3 border-t border-slate-100">
                  {weeklyOperationalBreakdown.map((day) => {
                    const hasManual = day.lunch.allergies?.includes('[manual]');
                    return (
                      <div key={day.dateStr} className={`p-2.5 rounded-lg border flex flex-col justify-between space-y-2 ${day.confirmado ? 'bg-indigo-50/20 border-indigo-100' : 'bg-slate-50/40 border-slate-150'}`}>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{day.label} {day.dayNum}</span>
                          {hasManual && (
                            <span className="text-[9px]" title="Comensales personalizados manualmente">👤</span>
                          )}
                        </div>
                        
                        <div className="space-y-1.5 text-[10px]">
                          {/* Desayuno */}
                          <div className="bg-amber-50/50 p-1 rounded border border-amber-100/50">
                            <span className="font-bold text-amber-800">🍳 Des:</span> <span className="font-extrabold">{day.breakfast.players} pax</span>
                            {(day.breakfast.halal > 0 || day.breakfast.kosher > 0 || day.breakfast.vegan > 0) && (
                              <div className="text-[8px] text-amber-700 font-medium mt-0.5 space-y-0.5">
                                {day.breakfast.halal > 0 && <div>🕌 Halal: {day.breakfast.halal}</div>}
                                {day.breakfast.kosher > 0 && <div>✡️ Kosher: {day.breakfast.kosher}</div>}
                                {day.breakfast.vegan > 0 && <div>🌱 Vegan: {day.breakfast.vegan}</div>}
                              </div>
                            )}
                          </div>

                          {/* Almuerzo */}
                          <div className="bg-indigo-50/50 p-1 rounded border border-indigo-100/50">
                            <span className="font-bold text-indigo-800">☀️ Alm:</span> <span className="font-extrabold">{day.lunch.players} pax</span>
                            {(day.lunch.halal > 0 || day.lunch.kosher > 0 || day.lunch.vegan > 0) && (
                              <div className="text-[8px] text-indigo-700 font-medium mt-0.5 space-y-0.5">
                                {day.lunch.halal > 0 && <div>🕌 Halal: {day.lunch.halal}</div>}
                                {day.lunch.kosher > 0 && <div>✡️ Kosher: {day.lunch.kosher}</div>}
                                {day.lunch.vegan > 0 && <div>🌱 Vegan: {day.lunch.vegan}</div>}
                              </div>
                            )}
                            {day.lunch.allergies && day.lunch.allergies.replace('[manual]', '').trim() && (
                              <div className="text-[8px] text-red-650 font-semibold mt-1 truncate" title={`Alergias: ${day.lunch.allergies.replace('[manual]', '').trim()}`}>
                                ⚠️ {day.lunch.allergies.replace('[manual]', '').trim()}
                              </div>
                            )}
                          </div>

                          {/* Cena */}
                          <div className="bg-emerald-50/50 p-1 rounded border border-emerald-100/50">
                            <span className="font-bold text-emerald-800">🌙 Cen:</span> <span className="font-extrabold">{day.dinner.players} pax</span>
                            {(day.dinner.halal > 0 || day.dinner.kosher > 0 || day.dinner.vegan > 0) && (
                              <div className="text-[8px] text-emerald-700 font-medium mt-0.5 space-y-0.5">
                                {day.dinner.halal > 0 && <div>🕌 Halal: {day.dinner.halal}</div>}
                                {day.dinner.kosher > 0 && <div>✡️ Kosher: {day.dinner.kosher}</div>}
                                {day.dinner.vegan > 0 && <div>🌱 Vegan: {day.dinner.vegan}</div>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── VISTA DÍA ── */}
          {viewMode === 'day' && (
            <div className="card p-5 bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDay(prev => Math.max(1, (prev || new Date().getDate()) - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
                      Día {selectedDay || new Date().getDate()} — Servicio Diario
                    </h2>
                    <p className="text-xs text-slate-500">
                      {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(prev => Math.min(31, (prev || new Date().getDate()) + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openDayEditor(selectedDay || new Date().getDate())}
                    className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 size={14} />
                    <span>Editar Día</span>
                  </button>
                )}
              </div>

              {(() => {
                const activeDayNum = selectedDay || getMadridTodayDateObject().getDate();
                const year = selectedDayYear !== null ? selectedDayYear : currentDate.getFullYear();
                const month = selectedDayMonth !== null ? selectedDayMonth : currentDate.getMonth();
                const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(activeDayNum).padStart(2, '0')}`;
                const menu = plannerData[dateISO] || null;

                const lunchName = menu?.lunch_recipe?.name || getRecipeName(menu?.lunch_recipe_id || menu?.lunch_recipe, 'Sin asignar');
                const rawSideId = menu?.lunch_side_recipe_id || menu?.lunch_side_recipe || menu?.side_dish || menu?.guarnicion;
                const lunchSideName = menu?.lunch_side_recipe?.name || (typeof rawSideId === 'object' ? rawSideId?.name : getRecipeName(rawSideId, 'Sin guarnición'));
                const dinnerName = menu?.dinner_recipe?.name || getRecipeName(menu?.dinner_recipe_id || menu?.dinner_recipe, 'Sin asignar');

                const weekMondayStr = getMadridMondayOfWeek(dateISO);
                const players = weeklyPlayers[weekMondayStr] || { lunch: 25, dinner: 20 };

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                          ☀️ Almuerzo
                        </span>
                        <div className="flex items-center gap-2">
                          {renderVegIndicator(menu?.lunch_recipe_id, players.lunch)}
                          <span className="badge badge-amber text-[10px]">{players.lunch} pax</span>
                        </div>
                      </div>
                      <p className="font-bold text-slate-800 text-base">{lunchName}</p>
                      {lunchSideName && lunchSideName !== 'Sin guarnición' && (
                        <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                          <span>🥗 Guarnición:</span> {lunchSideName}
                        </p>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                          🌙 Cena
                        </span>
                        <div className="flex items-center gap-2">
                          {renderVegIndicator(menu?.dinner_recipe_id, players.dinner)}
                          <span className="badge badge-indigo text-[10px]">{players.dinner} pax</span>
                        </div>
                      </div>
                      <p className="font-bold text-slate-800 text-base">{dinnerName}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                        👥 Comensales por día asignados
                      </span>
                      <div className="text-xs space-y-1 text-slate-600">
                        <div className="flex justify-between">
                          <span>🍳 Desayunos:</span>
                          <span className="font-bold text-slate-900">{menu?.breakfast_players !== undefined ? menu.breakfast_players : 20} pax</span>
                        </div>
                        <div className="flex justify-between">
                          <span>☀️ Almuerzos:</span>
                          <span className="font-bold text-slate-900">{menu?.lunch_players !== undefined ? menu.lunch_players : 25} pax</span>
                        </div>
                        <div className="flex justify-between">
                          <span>🌙 Cenas:</span>
                          <span className="font-bold text-slate-900">{menu?.dinner_players !== undefined ? menu.dinner_players : 20} pax</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── VISTA SEMANA ── */}
          {viewMode === 'week' && (
            <div className="space-y-3">
              {(() => {
                const weekNum = selectedWeeks[0] || 1;
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const weekDaysList = getMadridWeekRange(year, month, weekNum);
                const firstDay = weekDaysList[0];
                const lastDay = weekDaysList[6];
                
                const getMonthShortName = (m) => {
                  return new Date(2026, m, 1).toLocaleDateString('es-ES', { month: 'short' });
                };

                return (
                  <>
                    <div className="flex items-center justify-between bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                      <h3 className="font-bold text-indigo-900 text-sm">
                        Semana {weekNum} ({firstDay.dayNum} de {getMonthShortName(firstDay.month)} al {lastDay.dayNum} de {getMonthShortName(lastDay.month)})
                      </h3>
                      <span className="text-xs text-indigo-600 font-semibold">
                        {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2.5">
                      {(() => {
                        const now = getMadridTodayDateObject();
                        const cards = [];
                        
                        weekDaysList.forEach(({ dateStr, dayNum, month: dMonth, year: dYear, dayLabel }) => {
                          const isToday = now.getFullYear() === dYear && now.getMonth() === dMonth && dayNum === now.getDate();
                          const menu = plannerData[dateStr] || plannerData[dayNum] || null;

                          const lunchName = menu?.lunch_recipe?.name || getRecipeName(menu?.lunch_recipe_id || menu?.lunch_recipe, 'Sin asignar');
                          const rawSideId = menu?.lunch_side_recipe_id || menu?.lunch_side_recipe || menu?.side_dish || menu?.guarnicion;
                          const lunchSideName = menu?.lunch_side_recipe?.name || (typeof rawSideId === 'object' ? rawSideId?.name : getRecipeName(rawSideId, ''));
                          const dinnerName = menu?.dinner_recipe?.name || getRecipeName(menu?.dinner_recipe_id || menu?.dinner_recipe, 'Sin asignar');

                          cards.push(
                            <div 
                              key={`week-card-${dateStr}`}
                              onClick={() => openDayEditor(dayNum, dMonth, dYear)}
                              className={`card p-3 min-h-[160px] flex flex-col justify-between cursor-pointer transition-all ${
                                isToday ? 'ring-2 ring-brand bg-brand-muted/30 border-brand' : 'bg-white hover:border-brand/40 shadow-xs'
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-2">
                                  <span className="text-[11px] font-bold text-slate-400 uppercase">{dayLabel}</span>
                                  <span className={`text-xs font-black ${isToday ? 'text-brand' : 'text-slate-700'}`}>{dayNum}</span>
                                </div>

                                <div className="space-y-1.5">
                                  <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[9px] font-bold text-amber-700 block uppercase">Almuerzo</span>
                                      {renderVegIndicator(menu?.lunch_recipe_id, getLunchPlayers(menu, dateStr))}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-800 line-clamp-2">{lunchName}</p>
                                  </div>

                                  {lunchSideName && (
                                    <div>
                                      <span className="text-[9px] font-bold text-emerald-700 block uppercase">Guarnición</span>
                                      <p className="text-[11px] font-medium text-slate-600 truncate">{lunchSideName}</p>
                                    </div>
                                  )}

                                  <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[9px] font-bold text-indigo-700 block uppercase">Cena</span>
                                      {renderVegIndicator(menu?.dinner_recipe_id, getDinnerPlayers(menu, dateStr))}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-800 line-clamp-2">{dinnerName}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                                {menu?.lunch_allergies?.includes('[manual]') ? (
                                  <span className="flex items-center gap-0.5 text-indigo-600 font-bold bg-indigo-50 border border-indigo-200/50 px-1 py-0.5 rounded text-[8px] uppercase tracking-wide" title="Comensales personalizados manualmente">
                                    👤 Personalizado
                                  </span>
                                ) : (
                                  <span>Editar</span>
                                )}
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                              </div>
                            </div>
                          );
                        });
                        return cards;
                      })()}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          {/* ── VISTA RANGO PERSONALIZADO ── */}
          {viewMode === 'range' && (
            <div className="space-y-3">
              {(() => {
                const rangeDays = getDaysInRange(customStartDate, customEndDate);
                if (rangeDays.length === 0) {
                  return <div className="text-center text-slate-500 py-6">Selecciona fechas de inicio y fin válidas.</div>;
                }
                
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 gap-2">
                      <h3 className="font-bold text-indigo-900 text-sm">
                        Rango Personalizado: {customStartDate} al {customEndDate} ({rangeDays.length} días)
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2.5">
                      {(() => {
                        const now = getMadridTodayDateObject();
                        return rangeDays.map(({ dateStr, dayNum, month: dMonth, year: dYear, dayLabel }) => {
                          const isToday = now.getFullYear() === dYear && now.getMonth() === dMonth && dayNum === now.getDate();
                          const menu = plannerData[dateStr] || null;

                          const lunchName = menu?.lunch_recipe?.name || getRecipeName(menu?.lunch_recipe_id || menu?.lunch_recipe, 'Sin asignar');
                          const rawSideId = menu?.lunch_side_recipe_id || menu?.lunch_side_recipe || menu?.side_dish || menu?.guarnicion;
                          const lunchSideName = menu?.lunch_side_recipe?.name || (typeof rawSideId === 'object' ? rawSideId?.name : getRecipeName(rawSideId, ''));
                          const dinnerName = menu?.dinner_recipe?.name || getRecipeName(menu?.dinner_recipe_id || menu?.dinner_recipe, 'Sin asignar');

                          return (
                            <div 
                              key={`range-card-${dateStr}`}
                              onClick={() => openDayEditor(dayNum, dMonth, dYear)}
                              className={`card p-3 min-h-[160px] flex flex-col justify-between cursor-pointer transition-all ${
                                isToday ? 'ring-2 ring-brand bg-brand-muted/30 border-brand' : 'bg-white hover:border-brand/40 shadow-xs'
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-2">
                                  <span className="text-[11px] font-bold text-slate-400 uppercase">{dayLabel}</span>
                                  <span className={`text-xs font-black ${isToday ? 'text-brand' : 'text-slate-700'}`}>{dayNum}/{dMonth + 1}</span>
                                </div>

                                <div className="space-y-1.5">
                                  <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[9px] font-bold text-amber-700 block uppercase">Almuerzo</span>
                                      {renderVegIndicator(menu?.lunch_recipe_id, getLunchPlayers(menu, dateStr))}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-800 line-clamp-2">{lunchName}</p>
                                  </div>

                                  {lunchSideName && (
                                    <div>
                                      <span className="text-[9px] font-bold text-emerald-700 block uppercase">Guarnición</span>
                                      <p className="text-[11px] font-medium text-slate-600 truncate">{lunchSideName}</p>
                                    </div>
                                  )}

                                  <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[9px] font-bold text-indigo-700 block uppercase">Cena</span>
                                      {renderVegIndicator(menu?.dinner_recipe_id, getDinnerPlayers(menu, dateStr))}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-800 line-clamp-2">{dinnerName}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                                <span>Editar</span>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ── VISTA MES (CALENDARIO COMPLETO) ── */}
          {viewMode === 'month' && (
            <>
              {/* Mobile Compact Calendar Grid (7 columns matrix) */}
              <div className="md:hidden space-y-2">
                <div className="grid grid-cols-7 gap-1">
                  {['L','M','X','J','V','S','D'].map(d => (
                    <div key={d} className="text-center text-[11px] font-bold text-slate-400 uppercase py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const firstDayOffset = getMadridWeekdayIndex(year, month, 1);
                    const now = getMadridTodayDateObject();
                    const isCurrentMonthYear = now.getFullYear() === year && now.getMonth() === month;

                    const mobElements = [];

                    for (let empty = 0; empty < firstDayOffset; empty++) {
                      mobElements.push(
                        <div key={`m-empty-${empty}`} className="h-16 bg-slate-50/30 border border-dashed border-slate-100 rounded-lg" />
                      );
                    }

                    for (let d = 1; d <= daysInMonth; d++) {
                      const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const isToday = isCurrentMonthYear && d === now.getDate();
                      const menu = plannerData[dateISO] || null;

                      const hasLunch = !!(menu?.lunch_recipe_id || menu?.lunch_recipe);
                      const hasSide = !!(menu?.lunch_side_recipe_id || menu?.lunch_side_recipe);
                      const hasDinner = !!(menu?.dinner_recipe_id || menu?.dinner_recipe);
                      const hasMeal = hasLunch || hasDinner;

                      mobElements.push(
                        <div 
                          key={`m-day-${d}`}
                          onClick={() => openDayEditor(d)}
                          className={`p-1.5 h-16 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                            isToday 
                              ? 'ring-2 ring-brand bg-brand-muted/30 border-brand' 
                              : hasMeal 
                                ? 'bg-indigo-50/70 border-indigo-200 shadow-xs' 
                                : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1">
                              <span className={`text-xs font-black ${isToday ? 'text-brand' : 'text-slate-700'}`}>{d}</span>
                              {menu?.lunch_allergies?.includes('[manual]') && (
                                <span className="text-[9px] text-indigo-600 font-bold" title="Comensales personalizados manualmente">👤</span>
                              )}
                            </div>
                            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>}
                          </div>

                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {hasLunch ? (
                              <div className="flex items-center justify-between gap-1 w-full">
                                <div className="flex items-center gap-1 text-[9px] font-bold text-amber-700 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  <span className="truncate">{menu?.lunch_recipe?.name || 'Almuerzo'}</span>
                                </div>
                                {renderVegIndicator(menu?.lunch_recipe_id, getLunchPlayers(menu, dateISO))}
                              </div>
                            ) : null}
                            {hasSide ? (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                <span className="truncate">{menu?.lunch_side_recipe?.name || 'Guarnición'}</span>
                              </div>
                            ) : null}
                            {hasDinner ? (
                              <div className="flex items-center justify-between gap-1 w-full">
                                <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-700 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                  <span className="truncate">{menu?.dinner_recipe?.name || 'Cena'}</span>
                                </div>
                                {renderVegIndicator(menu?.dinner_recipe_id, getDinnerPlayers(menu, dateISO))}
                              </div>
                            ) : null}
                            {!hasMeal && (
                              <span className="text-[9px] text-slate-300 italic truncate">Vacío</span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return mobElements;
                  })()}
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
                  const firstDayOffset = getMadridWeekdayIndex(year, month, 1);
                  
                  const now = getMadridTodayDateObject();
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
                    const menu = plannerData[dateISO] || null;

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
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold font-display ${isToday ? 'text-brand' : 'text-slate-500'}`}>{d}</span>
                            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>}
                            {menu?.lunch_allergies?.includes('[manual]') && (
                              <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200/60 rounded px-1 flex items-center font-bold" title="Comensales personalizados manualmente">
                                👤
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openDayEditor(d)}
                                className="text-slate-400 hover:text-brand transition-colors flex items-center p-0.5 rounded-md hover:bg-slate-100"
                                title="Editar"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span>
                              </button>
                              {hasMeal && (
                                <button
                                  onClick={() => handleClearDay(d)}
                                  className="text-slate-300 hover:text-red-500 transition-colors flex items-center p-0.5 rounded-md hover:bg-slate-100"
                                  title="Vaciar día"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 flex-grow overflow-hidden">
                          {/* 1. Almuerzo / Plato Principal */}
                          <div 
                            title={`Almuerzo: ${lunchName}`}
                            className={`p-1.5 rounded-md text-[10px] font-medium leading-tight border ${
                              menu?.lunch_recipe_id 
                                ? 'bg-amber-50/90 border-amber-200 text-amber-950' 
                                : 'bg-slate-50 border-slate-100 text-slate-400 italic'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                <span className="font-extrabold uppercase text-[9px] text-amber-800">Almuerzo</span>
                              </div>
                              {renderVegIndicator(menu?.lunch_recipe_id, getLunchPlayers(menu, dateISO))}
                            </div>
                            <p className="truncate font-semibold">{lunchName}</p>
                          </div>

                          {/* 2. Guarnición Almuerzo */}
                          {lunchSideName ? (
                            <div 
                              title={`Guarnición: ${lunchSideName}`}
                              className="p-1 rounded-md text-[10px] font-medium leading-tight bg-emerald-50/90 border border-emerald-200 text-emerald-950"
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                <span className="font-extrabold uppercase text-[8px] text-emerald-800">Guarnición</span>
                              </div>
                              <p className="truncate text-[10px]">{lunchSideName}</p>
                            </div>
                          ) : null}

                          {/* 3. Cena */}
                          <div 
                            title={`Cena: ${dinnerName}`}
                            className={`p-1.5 rounded-md text-[10px] font-medium leading-tight border ${
                              menu?.dinner_recipe_id 
                                ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950' 
                                : 'bg-slate-50 border-slate-100 text-slate-400 italic'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                <span className="font-extrabold uppercase text-[9px] text-indigo-800">Cena</span>
                              </div>
                              {renderVegIndicator(menu?.dinner_recipe_id, getDinnerPlayers(menu, dateISO))}
                            </div>
                            <p className="truncate font-semibold">{dinnerName}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return elements;
                })()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODAL: EDITAR PLANIFICACIÓN DÍA (REACT) ── */}
      {dayModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setDayModalOpen(false); }}>
          <div className="modal-box max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-5 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Planificar Día</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedDay} de {new Date(selectedDayYear !== null ? selectedDayYear : currentDate.getFullYear(), selectedDayMonth !== null ? selectedDayMonth : currentDate.getMonth(), 1).toLocaleDateString('es-ES', { month: 'long' })} del {selectedDayYear !== null ? selectedDayYear : currentDate.getFullYear()}
                </p>
              </div>
              <button onClick={() => setDayModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-2">

              {/* ═══════ SECCIÓN DESAYUNO ═══════ */}
              <div className="border-l-4 border-amber-400 pl-3 space-y-3">
                <label className="block text-xs font-bold text-amber-700 uppercase tracking-wide">🌅 Desayuno</label>
                <p className="text-[10px] text-slate-400 -mt-2 italic">Receta fija asignada automáticamente.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Comensales</label>
                    <input 
                      type="number" 
                      value={dayForm.breakfast_players} 
                      onChange={e => setDayForm(prev => ({ ...prev, breakfast_players: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg text-sm outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Dietas Activas (Comensales)</label>
                    <div className="flex gap-2 overflow-x-auto">
                      <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold border border-emerald-200">
                        <span>Halal:</span><span>{activeDietCounts.halal}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">
                        <span>Kosher:</span><span>{activeDietCounts.kosher}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-md text-xs font-bold border border-orange-200">
                        <span>Vegano:</span><span>{activeDietCounts.vegan}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs font-bold border border-green-200">
                        <span>Vegetariano:</span><span>{activeDietCounts.vegetarian}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══════ SECCIÓN ALMUERZO ═══════ */}
              <div className="border-l-4 border-brand pl-3 space-y-3">
                <label className="block text-xs font-bold text-brand uppercase tracking-wide">☀️ Almuerzo</label>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Plato Principal</label>
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
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">🥗 Guarnición</label>
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Comensales</label>
                    <input 
                      type="number" 
                      value={dayForm.lunch_players} 
                      onChange={e => setDayForm(prev => ({ ...prev, lunch_players: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 border border-brand/30 rounded-lg text-sm outline-none focus:border-brand transition-colors"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Dietas Activas (Comensales)</label>
                    <div className="flex gap-2 overflow-x-auto">
                      <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold border border-emerald-200">
                        <span>Halal:</span><span>{activeDietCounts.halal}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">
                        <span>Kosher:</span><span>{activeDietCounts.kosher}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-md text-xs font-bold border border-orange-200">
                        <span>Vegano:</span><span>{activeDietCounts.vegan}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs font-bold border border-green-200">
                        <span>Vegetariano:</span><span>{activeDietCounts.vegetarian}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══════ SECCIÓN CENA ═══════ */}
              <div className="border-l-4 border-indigo-400 pl-3 space-y-3">
                <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wide">🌙 Cena</label>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Plato</label>
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Comensales</label>
                    <input 
                      type="number" 
                      value={dayForm.dinner_players} 
                      onChange={e => setDayForm(prev => ({ ...prev, dinner_players: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Dietas Activas (Comensales)</label>
                    <div className="flex gap-2 overflow-x-auto">
                      <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold border border-emerald-200">
                        <span>Halal:</span><span>{activeDietCounts.halal}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">
                        <span>Kosher:</span><span>{activeDietCounts.kosher}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-md text-xs font-bold border border-orange-200">
                        <span>Vegano:</span><span>{activeDietCounts.vegan}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs font-bold border border-green-200">
                        <span>Vegetariano:</span><span>{activeDietCounts.vegetarian}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setDayModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancelar
              </button>
              <button 
                onClick={handleSaveDay} 
                disabled={saveStatus === 'saving' || saveStatus === 'success'}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 ${
                  saveStatus === 'saving' 
                    ? 'bg-slate-500 cursor-not-allowed' 
                    : saveStatus === 'success' 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : saveStatus === 'error' 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-brand hover:bg-brand-dark'
                }`}
              >
                {saveStatus === 'saving' && (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                )}
                {saveStatus === 'success' && (
                  <>
                    <span>✓ ¡Guardado!</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <span>❌ Error</span>
                  </>
                )}
                {saveStatus === 'idle' && <span>Guardar Día</span>}
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
                  <span className="text-[11px] text-slate-500">
                    Vacía únicamente las comidas del día {selectedDay ? `${selectedDay} de ${new Date(selectedDayYear || currentDate.getFullYear(), selectedDayMonth || currentDate.getMonth(), 1).toLocaleDateString('es-ES', { month: 'long' })}` : 'seleccionado'}.
                  </span>
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

      {/* ── MODAL: GESTIÓN DE COMENSALES (REACT) ── */}
      <ComensalesModal 
        isOpen={comensalesModalOpen}
        onClose={() => setComensalesModalOpen(false)}
      />

      {/* ── MODAL: ASIGNACIÓN DE COMENSALES BASE SEMANALES ── */}
      {baseComensalesModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setBaseComensalesModalOpen(false); }}>
          <div className="modal-box max-w-md max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Users className="text-brand" size={22} />
                <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
                  Asignar Comensales Base (Semana {selectedWeeks[0] || 1})
                </h3>
              </div>
              <button onClick={() => setBaseComensalesModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 space-y-4 flex-1 pb-4">
              <p className="text-xs text-slate-500 bg-indigo-50 border border-indigo-100 rounded-xl p-3 leading-relaxed">
                💡 Introduce el número de comensales (Pax) para cada servicio. Las dietas especiales (Halal, Kosher, Vegano) y alergias se calcularán automáticamente en base a los perfiles de la academia. Se respetarán los días personalizados (👤).
              </p>

              {/* 🍳 DESAYUNO */}
              <div className="border-l-4 border-amber-400 pl-3 space-y-2">
                <label className="block text-xs font-bold text-amber-700 uppercase tracking-wide">🍳 Desayuno Base</label>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Pax</label>
                  <input 
                    type="number" 
                    value={baseComensalesForm.breakfast_players} 
                    onChange={e => setBaseComensalesForm(prev => ({ ...prev, breakfast_players: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* ☀️ ALMUERZO */}
              <div className="border-l-4 border-brand pl-3 space-y-2">
                <label className="block text-xs font-bold text-brand uppercase tracking-wide">☀️ Almuerzo Base</label>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Pax</label>
                  <input 
                    type="number" 
                    value={baseComensalesForm.lunch_players} 
                    onChange={e => setBaseComensalesForm(prev => ({ ...prev, lunch_players: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* 🌙 CENA */}
              <div className="border-l-4 border-indigo-400 pl-3 space-y-2">
                <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wide">🌙 Cena Base</label>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Pax</label>
                  <input 
                    type="number" 
                    value={baseComensalesForm.dinner_players} 
                    onChange={e => setBaseComensalesForm(prev => ({ ...prev, dinner_players: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setBaseComensalesModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancelar
              </button>
              <button 
                onClick={handleApplyWeeklyComensales} 
                className="px-5 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg shadow-sm transition-all"
              >
                Aplicar a la Semana
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
