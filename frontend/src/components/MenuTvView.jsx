import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Clock, Tv, Star, ShieldAlert } from 'lucide-react';

export default function MenuTvView() {
  const [plannerData, setPlannerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  const getWeekRange = () => {
    const today = new Date();
    const day = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday-start
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    const dates = [];
    const weekdaysText = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push({
        dateStr: d.toISOString().split('T')[0],
        dayNum: d.getDate(),
        dayLabel: weekdaysText[i]
      });
    }
    return { monday, dates };
  };

  const { monday, dates: weekDays } = getWeekRange();

  const getWeekRangeLabel = (monDate) => {
    const sunDate = new Date(monDate);
    sunDate.setDate(monDate.getDate() + 6);
    
    const optionsMonth = { month: 'long' };
    const monMonth = monDate.toLocaleDateString('en-US', optionsMonth).toUpperCase();
    const sunMonth = sunDate.toLocaleDateString('en-US', optionsMonth).toUpperCase();
    
    return `${monMonth} ${monDate.getDate()} - ${sunMonth} ${sunDate.getDate()}, ${monDate.getFullYear()}`;
  };

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

    // 1. Polling fallback every 60 seconds
    const interval = setInterval(loadMenuData, 60000);

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
    <div className="h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 text-slate-100 flex flex-col p-8 select-none overflow-hidden font-display" style={{ fontFamily: 'Outfit, sans-serif' }}>
      
      {/* HEADER */}
      <header className="flex justify-between items-center border-b border-slate-800/80 pb-5 mb-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 via-amber-600 to-red-600 p-0.5 shadow-xl shadow-amber-950/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center overflow-hidden">
              <img 
                src="logo.png" 
                alt="ACFC Logo" 
                className="w-8 h-8 object-contain"
                onError={(e) => { e.target.outerHTML = '<span className="text-xl font-bold text-amber-500">🏆</span>'; }}
              />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 via-yellow-100 to-white bg-clip-text text-transparent">
              WEEKLY MENU
            </h1>
            <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2 mt-0.5">
              <Tv size={13} />
              <span>ATHLETIC CLUB FOOD CLUB · DIGITAL SIGNAGE</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400 font-semibold">{getWeekRangeLabel(monday)}</span>
            </p>
          </div>
        </div>

        {/* Dynamic Clock */}
        <div className="flex items-center gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800 px-5 py-2.5 rounded-2xl text-xs font-bold shadow-lg">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar size={15} className="text-amber-500" />
            <span>
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase()}
            </span>
          </div>
          <span className="text-slate-800">|</span>
          <div className="flex items-center gap-2 text-white font-mono text-[14px] tracking-wider">
            <Clock size={15} className="text-amber-500 animate-pulse" />
            <span>
              {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
        </div>
      </header>

      {/* LOADING */}
      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Synchronizing kitchen board...</span>
        </div>
      ) : (
        /* GRID DE MENÚ: Lunes a Domingo */
        <div className="flex-grow grid grid-cols-7 gap-5 items-stretch overflow-hidden">
          {weekDays.map(({ dateStr, dayNum, dayLabel }) => {
            const menu = plannerData.find(m => m.date === dateStr);
            const isToday = todayStr === dateStr;

            const lunchName = menu?.lunch_recipe?.name || '';
            const lunchSide = menu?.lunch_side_recipe?.name || '';
            const dinnerName = menu?.dinner_recipe?.name || '';

            return (
              <div 
                key={dateStr}
                className={`flex flex-col rounded-3xl border transition-all duration-500 relative ${
                  isToday 
                    ? 'bg-slate-900/90 border-amber-500 ring-2 ring-amber-500/20 shadow-2xl shadow-amber-500/5' 
                    : 'bg-slate-900/35 border-slate-800/80 hover:border-slate-800'
                }`}
              >
                {/* Active Indicator Pin */}
                {isToday && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[9px] font-black uppercase px-3 py-0.5 rounded-full tracking-widest shadow-lg flex items-center gap-1">
                    <Star size={8} fill="currentColor" />
                    <span>TODAY</span>
                  </div>
                )}

                {/* Day Header */}
                <div className={`p-4 border-b text-center rounded-t-3xl ${
                  isToday 
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black' 
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                }`}>
                  <span className="block text-[11px] uppercase tracking-widest font-black leading-none">{dayLabel}</span>
                  <span className={`text-xl font-black font-mono mt-1.5 inline-block leading-none ${isToday ? 'text-slate-950' : 'text-white'}`}>{dayNum}</span>
                </div>

                {/* Meal Content */}
                <div className="flex-grow p-5 flex flex-col justify-evenly gap-5 overflow-hidden">
                  
                  {/* LUNCH */}
                  <div className="space-y-2 flex-grow flex flex-col justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">LUNCH</span>
                    </div>
                    {lunchName ? (
                      <div className="min-h-[56px] flex flex-col justify-start">
                        <p className="text-xs font-black text-slate-100 line-clamp-2 leading-snug uppercase tracking-tight">{lunchName}</p>
                        {lunchSide && (
                          <p className="text-[9px] text-emerald-400 font-extrabold mt-1.5 inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md self-start">
                            🥗 SIDE: {lunchSide.toUpperCase()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-slate-700 italic uppercase tracking-wider">No service</p>
                    )}
                  </div>

                  {/* Horizontal Separator */}
                  <div className="border-t border-slate-800/80" />

                  {/* DINNER */}
                  <div className="space-y-2 flex-grow flex flex-col justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">DINNER</span>
                    </div>
                    {dinnerName ? (
                      <div className="min-h-[56px] flex flex-col justify-start">
                        <p className="text-xs font-black text-slate-100 line-clamp-2 leading-snug uppercase tracking-tight">{dinnerName}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-slate-700 italic uppercase tracking-wider">No service</p>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-6 pt-4 border-t border-slate-900 flex justify-between items-center text-[10px] font-black text-slate-500 flex-shrink-0 uppercase tracking-widest">
        <span>Designed for Athletic Club dining halls & player lounges</span>
        <span className="flex items-center gap-2 text-emerald-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Realtime kitchen synchronization active
        </span>
      </footer>

    </div>
  );
}
