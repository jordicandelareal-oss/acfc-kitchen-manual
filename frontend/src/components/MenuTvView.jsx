import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Clock, Tv, Star, Flame } from 'lucide-react';

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

    // Polling every 60 seconds
    const interval = setInterval(loadMenuData, 60000);

    // Realtime changes listener
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
    <div className="h-screen w-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col p-8 select-none overflow-hidden relative">
      
      {/* BACKGROUND TEXTURE MESH */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />

      {/* HEADER */}
      <header className="flex justify-between items-center border-b border-white/5 pb-5 mb-5 flex-shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 p-0.5 shadow-2xl shadow-amber-500/10">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center overflow-hidden">
              <img 
                src="logo.png" 
                alt="ACFC Logo" 
                className="w-10 h-10 object-contain"
                onError={(e) => { e.target.outerHTML = '<span className="text-2xl font-bold text-amber-500">🏆</span>'; }}
              />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 via-yellow-100 to-white bg-clip-text text-transparent" style={{ fontFamily: 'Outfit, sans-serif' }}>
              WEEKLY MENU
            </h1>
            <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mt-0.5">
              <Tv size={14} className="text-amber-500 animate-pulse" />
              <span>ACFC ATHLETIC CLUB KITCHEN · DIGITAL SIGNAGE</span>
              <span className="text-slate-800">|</span>
              <span className="text-slate-300 font-semibold">{getWeekRangeLabel(monday)}</span>
            </p>
          </div>
        </div>

        {/* Dynamic Clock */}
        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl text-xs font-bold shadow-2xl">
          <div className="flex items-center gap-2 text-slate-200">
            <Calendar size={16} className="text-amber-400" />
            <span className="tracking-wide">
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase()}
            </span>
          </div>
          <span className="text-white/10">|</span>
          <div className="flex items-center gap-2 text-white font-mono text-[16px] tracking-wider">
            <Clock size={16} className="text-amber-400" />
            <span>
              {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
        </div>
      </header>

      {/* LOADING */}
      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center gap-3 relative z-10">
          <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Synchronizing kitchen board...</span>
        </div>
      ) : (
        /* GRID DE MENÚ: Lunes a Domingo */
        <div className="flex-grow grid grid-cols-7 gap-5 items-stretch overflow-hidden relative z-10">
          {weekDays.map(({ dateStr, dayNum, dayLabel }) => {
            const menu = plannerData.find(m => m.date === dateStr);
            const isToday = todayStr === dateStr;

            const lunchName = menu?.lunch_recipe?.name || '';
            const lunchSide = menu?.lunch_side_recipe?.name || '';
            const dinnerName = menu?.dinner_recipe?.name || '';

            return (
              <div 
                key={dateStr}
                className={`flex flex-col rounded-[2rem] transition-all duration-500 relative ${
                  isToday 
                    ? 'bg-slate-900/80 border-t-4 border-t-amber-400 border-x border-b border-white/20 shadow-[0_0_30px_rgba(251,191,36,0.18)]' 
                    : 'bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/80 hover:bg-white/10'
                }`}
              >
                {/* Active Indicator Pin */}
                {isToday && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[10px] font-black uppercase px-4 py-0.5 rounded-full tracking-widest shadow-lg flex items-center gap-1.5 border border-amber-300">
                    <Flame size={10} className="animate-bounce" />
                    <span>TODAY</span>
                  </div>
                )}

                {/* Day Header */}
                <div className={`p-5 border-b text-center rounded-t-[2rem] ${
                  isToday 
                    ? 'bg-amber-400/10 border-white/10' 
                    : 'bg-slate-950/40 border-white/5'
                }`}>
                  <span className={`block text-xs uppercase tracking-widest font-black ${isToday ? 'text-amber-400' : 'text-slate-400'}`}>{dayLabel}</span>
                  <span className="text-2xl font-black font-mono mt-1.5 inline-block text-white leading-none">{dayNum}</span>
                </div>

                {/* Meal Content */}
                <div className="flex-grow p-6 flex flex-col justify-evenly gap-6 overflow-hidden">
                  
                  {/* LUNCH */}
                  <div className="space-y-2 flex-grow flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest leading-none">LUNCH</span>
                    {lunchName ? (
                      <div className="flex flex-col justify-start">
                        <p className="text-[15px] font-extrabold text-white leading-snug uppercase tracking-tight line-clamp-3">
                          {lunchName}
                        </p>
                        {lunchSide && (
                          <div className="mt-2.5 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg self-start">
                            <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-widest">
                              🥗 SIDE: {lunchSide}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] font-bold text-slate-600 italic uppercase tracking-wider">No service</p>
                    )}
                  </div>

                  {/* Horizontal Separator */}
                  <div className="border-t border-white/10" />

                  {/* DINNER */}
                  <div className="space-y-2 flex-grow flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">DINNER</span>
                    {dinnerName ? (
                      <div className="flex flex-col justify-start">
                        <p className="text-[15px] font-extrabold text-white leading-snug uppercase tracking-tight line-clamp-3">
                          {dinnerName}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] font-bold text-slate-600 italic uppercase tracking-wider">No service</p>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-black text-slate-500 flex-shrink-0 uppercase tracking-widest relative z-10">
        <span>Designed for Athletic Club dining halls & player lounges</span>
        <span className="flex items-center gap-2 text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Realtime kitchen synchronization active
        </span>
      </footer>

    </div>
  );
}
