import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Clock, Star, Flame } from 'lucide-react';

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
    <div 
      className="h-screen w-screen text-slate-100 flex flex-col p-8 select-none overflow-hidden relative"
      style={{
        fontFamily: 'Outfit, sans-serif',
        backgroundImage: "url('/stadium-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      
      {/* DARK OVERLAY FOR CONTRAST */}
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] z-0" />

      {/* HEADER - CENTERED */}
      <header className="flex flex-col items-center justify-center text-center border-b border-white/10 pb-5 mb-5 flex-shrink-0 relative z-10 w-full">
        {/* Logo increased by 15% (h-32) */}
        <div className="h-32 max-h-32 mb-3 flex items-center justify-center overflow-hidden">
          <img 
            src="/logo_tv.png" 
            alt="ACFC Logo" 
            className="h-full object-contain"
            onError={(e) => { e.target.outerHTML = '<span className="text-5xl font-black text-amber-500">ACFC</span>'; }}
          />
        </div>

        <h1 className="text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 via-yellow-100 to-white bg-clip-text text-transparent">
          WEEKLY MENU
        </h1>
        {/* Clean date range header only */}
        <p className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center justify-center gap-2 mt-1">
          <span>{getWeekRangeLabel(monday)}</span>
        </p>

        {/* Dynamic Clock - Top Right */}
        <div className="absolute top-0 right-0 flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-2xl text-xs font-bold shadow-2xl">
          <div className="flex items-center gap-2 text-slate-200">
            <Calendar size={15} className="text-amber-400" />
            <span className="tracking-wide">
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase()}
            </span>
          </div>
          <span className="text-white/10">|</span>
          <div className="flex items-center gap-2 text-white font-mono text-[15px] tracking-wider">
            <Clock size={15} className="text-amber-400" />
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
                // Opacity adjusted strictly to 70% (bg-slate-900/70 and bg-slate-950/70)
                className={`flex flex-col rounded-[2rem] transition-all duration-500 relative ${
                  isToday 
                    ? 'bg-slate-950/70 border-t-4 border-t-amber-400 border-x border-b border-white/20 shadow-[0_0_30px_rgba(251,191,36,0.22)] backdrop-blur-md' 
                    : 'bg-slate-900/70 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/80 hover:bg-slate-900/75'
                }`}
              >
                {/* Active Indicator Pin */}
                {isToday && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[10px] font-black uppercase px-4 py-0.5 rounded-full tracking-widest shadow-lg flex items-center gap-1.5 border border-amber-300">
                    <Flame size={10} className="animate-bounce" />
                    <span>TODAY</span>
                  </div>
                )}

                {/* Day Header - reduced padding for compactness */}
                <div className={`p-4 border-b text-center rounded-t-[2rem] ${
                  isToday 
                    ? 'bg-amber-400/10 border-white/10' 
                    : 'bg-slate-950/50 border-white/5'
                }`}>
                  <span className={`block text-xl uppercase font-bold tracking-tight ${
                    isToday ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'text-white'
                  }`}>
                    {dayLabel}
                  </span>
                  <span className="text-xs font-extrabold font-mono mt-1 inline-block text-slate-400 leading-none">
                    {dateStr.split('-')[1]}/{dayNum}
                  </span>
                </div>

                {/* Meal Content - padding reduced by 20% to p-4.5/p-4 */}
                <div className="flex-grow p-4.5 flex flex-col justify-evenly gap-5 overflow-hidden">
                  
                  {/* LUNCH */}
                  <div className="space-y-1.5 flex-grow flex flex-col justify-center">
                    {/* Shift text size increased to text-xl */}
                    <span className="text-xl font-black uppercase text-amber-400 tracking-widest leading-none">LUNCH</span>
                    {lunchName ? (
                      <div className="flex flex-col justify-start">
                        {/* Recipe text size reduced to text-[22px] */}
                        <p className="text-[22px] font-black text-white leading-tight uppercase tracking-tight line-clamp-3">
                          {lunchName}
                        </p>
                        {lunchSide && (
                          <div className="mt-2 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg self-start">
                            <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">
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
                  <div className="space-y-1.5 flex-grow flex flex-col justify-center">
                    {/* Shift text size increased to text-xl */}
                    <span className="text-xl font-black uppercase text-slate-400 tracking-widest leading-none">DINNER</span>
                    {dinnerName ? (
                      <div className="flex flex-col justify-start">
                        {/* Recipe text size reduced to text-[22px] */}
                        <p className="text-[22px] font-black text-white leading-tight uppercase tracking-tight line-clamp-3">
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
