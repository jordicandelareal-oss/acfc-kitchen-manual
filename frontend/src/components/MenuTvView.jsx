import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Sparkles, Calendar, Clock, Tv } from 'lucide-react';

export default function MenuTvView() {
  const [plannerData, setPlannerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  const getWeekRange = () => {
    const today = new Date();
    const day = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday-start
    const monday = new Date(today.setDate(diff));
    
    const dates = [];
    const weekdaysText = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push({
        dateStr: d.toISOString().split('T')[0],
        dayNum: d.getDate(),
        dayLabel: weekdaysText[i]
      });
    }
    return dates;
  };

  const weekDays = getWeekRange();

  const loadMenuData = async () => {
    try {
      const dateList = weekDays.map(d => d.dateStr);
      const { data, error } = await supabase
        .from('menu_planner')
        .select(`
          *,
          lunch_recipe:recipes!lunch_recipe_id(name),
          lunch_side_recipe:recipes!lunch_side_recipe_id(name),
          dinner_recipe:recipes!dinner_recipe_id(name)
        `)
        .in('date', dateList);

      if (error) throw error;
      setPlannerData(data || []);
    } catch (err) {
      console.error('Error loading TV menu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenuData();

    // 1. Polling fallback every 2 minutes
    const interval = setInterval(loadMenuData, 120000);

    // 2. Realtime listener for direct instant updates
    const subscription = supabase
      .channel('tv_menu_planner_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_planner' }, () => {
        loadMenuData();
      })
      .subscribe();

    // Clock updater
    const clockInterval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
      subscription.unsubscribe();
    };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 select-none overflow-hidden font-display" style={{ fontFamily: 'Outfit, sans-serif' }}>
      
      {/* HEADER */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <img 
              src="logo.png" 
              alt="ACFC Logo" 
              className="w-7 h-7 object-contain"
              onError={(e) => { e.target.outerHTML = '⚽'; }}
            />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              MENÚ SEMANAL · ATHLETIC CLUB FOOD CLUB
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
              <Tv size={12} className="text-indigo-500" />
              <span>Pantalla de Menú Confirmado</span>
            </p>
          </div>
        </div>

        {/* Dynamic Clock */}
        <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Calendar size={14} className="text-indigo-400" />
            <span>
              {time.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[13px] tracking-wider">
            <Clock size={14} />
            <span>
              {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      {/* LOADING */}
      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-400">Sincronizando con cocina...</span>
        </div>
      ) : (
        /* GRID DE MENÚ: Lunes a Domingo */
        <div className="flex-grow grid grid-cols-7 gap-4 items-stretch">
          {weekDays.map(({ dateStr, dayNum, dayLabel }) => {
            const menu = plannerData.find(m => m.date === dateStr);
            const isToday = todayStr === dateStr;

            const lunchName = menu?.lunch_recipe?.name || '';
            const lunchSide = menu?.lunch_side_recipe?.name || '';
            const dinnerName = menu?.dinner_recipe?.name || '';

            return (
              <div 
                key={dateStr}
                className={`flex flex-col rounded-2xl border transition-all duration-300 ${
                  isToday 
                    ? 'bg-gradient-to-b from-slate-900 to-indigo-950/70 border-indigo-500 ring-2 ring-indigo-500/30 shadow-2xl' 
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-800'
                }`}
              >
                {/* Header del Día */}
                <div className={`p-3.5 border-b text-center rounded-t-2xl ${
                  isToday 
                    ? 'bg-indigo-600 text-white font-extrabold' 
                    : 'bg-slate-950/80 border-slate-800/80 text-slate-400'
                }`}>
                  <span className="block text-[11px] uppercase tracking-wider font-black">{dayLabel}</span>
                  <span className={`text-base font-extrabold font-mono mt-0.5 inline-block ${isToday ? '' : 'text-slate-300'}`}>{dayNum}</span>
                </div>

                {/* Comidas / Contenido */}
                <div className="flex-grow p-4 flex flex-col justify-evenly gap-4">
                  
                  {/* ALMUERZO */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-1">
                      <span>🌞 Almuerzo</span>
                    </span>
                    {lunchName ? (
                      <div>
                        <p className="text-xs font-bold text-slate-200 line-clamp-3 leading-snug">{lunchName}</p>
                        {lunchSide && (
                          <p className="text-[10px] text-emerald-400 font-bold mt-1 inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                            🥗 {lunchSide}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] italic text-slate-600 font-bold">Sin servicio</p>
                    )}
                  </div>

                  {/* Division */}
                  <div className="border-t border-slate-800/60" />

                  {/* CENA */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest flex items-center gap-1">
                      <span>🌙 Cena</span>
                    </span>
                    {dinnerName ? (
                      <p className="text-xs font-bold text-slate-200 line-clamp-3 leading-snug">{dinnerName}</p>
                    ) : (
                      <p className="text-[10px] italic text-slate-600 font-bold">Sin servicio</p>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-[10px] font-bold text-slate-600 flex-shrink-0 uppercase tracking-widest">
        <span>Diseñado para pantallas de salón y comedor</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Conectado en Tiempo Real con Cocina
        </span>
      </footer>

    </div>
  );
}
