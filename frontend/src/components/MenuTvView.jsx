import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Star, Flame } from 'lucide-react';
import { getMadridWeekDays, getMadridWeekRangeLabel, getMadridTodayStr } from '../utils/dateUtils';

export default function MenuTvView() {
  const [plannerData, setPlannerData] = useState([]);
  const [loading, setLoading] = useState(true);

  const { monday, dates: weekDays } = getMadridWeekDays();


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

    // Polling every 3 minutes as backup/fallback
    const interval = setInterval(loadMenuData, 180000);

    // Realtime changes listener for menu_planner
    const plannerSubscription = supabase
      .channel('tv_menu_planner_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_planner' }, () => {
        loadMenuData();
      })
      .subscribe();

    // Realtime changes listener for recipes
    const recipesSubscription = supabase
      .channel('tv_recipes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => {
        loadMenuData();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      plannerSubscription.unsubscribe();
      recipesSubscription.unsubscribe();
    };
  }, []);

  const todayStr = getMadridTodayStr();

  return (
    <div 
      className="min-h-screen w-full text-slate-100 flex flex-col p-4 md:p-8 select-none md:h-screen md:overflow-hidden relative"
      style={{
        fontFamily: 'Outfit, sans-serif',
        backgroundImage: "url('/stadium-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      
      {/* DARK OVERLAY FOR CONTRAST */}
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px] z-0" />

      {/* TOP DEGRADADO OSCURO (GRADIENT OVERLAY) FOR HEADER CONTRAST */}
      <div className="absolute top-0 inset-x-0 h-48 md:h-72 bg-gradient-to-b from-black/85 via-black/40 to-transparent z-0 pointer-events-none" />

      {/* HEADER - CENTERED & SHIFTED DOWN */}
      <header className="flex flex-col items-center justify-center text-center border-b border-white/10 pb-4 mb-4 md:pb-5 md:mb-5 flex-shrink-0 relative z-10 w-full pt-4 md:pt-16">
        {/* Centered Logo */}
        <div className="h-16 md:h-36 max-h-16 md:max-h-36 mb-3 md:mb-4 flex items-center justify-center overflow-hidden">
          <img 
            src="/logo_tv.png" 
            alt="ACFC Logo" 
            className="h-full object-contain"
            onError={(e) => { e.target.outerHTML = '<span className="text-3xl md:text-5xl font-black text-amber-500">ACFC</span>'; }}
          />
        </div>

        <h1 className="text-xl md:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 via-yellow-100 to-white bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
          WEEKLY MENU
        </h1>
        
        {/* Pastilla / Badge with dates */}
        <div className="mt-2 md:mt-3 bg-slate-950/85 border border-amber-400/40 px-5 md:px-8 py-1.5 md:py-2 rounded-full shadow-lg backdrop-blur-md">
          <span className="text-amber-400 font-extrabold tracking-wider text-base md:text-[26px] leading-none block">
            {getMadridWeekRangeLabel(monday)}
          </span>
        </div>
      </header>

      {/* LOADING */}
      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center gap-3 relative z-10">
          <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest">Synchronizing kitchen board...</span>
        </div>
      ) : (
        /* GRID DE MENÚ: Lunes a Domingo - centered vertically */
        <div className="flex-grow flex flex-col justify-center relative z-10 md:overflow-hidden py-2 md:py-0">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 md:gap-5 items-stretch w-full">
            {weekDays.map(({ dateStr, dayNum, dayLabel }) => {
              const menu = plannerData.find(m => m.date === dateStr);
              const isToday = todayStr === dateStr;

              const lunchName = menu?.lunch_recipe?.name || '';
              const lunchSide = menu?.lunch_side_recipe?.name || '';
              const dinnerName = menu?.dinner_recipe?.name || '';

              return (
                <div 
                  key={dateStr}
                  className={`flex flex-col rounded-[1.5rem] md:rounded-[2rem] transition-all duration-500 relative ${
                    isToday 
                      ? 'bg-slate-950/75 border-t-4 border-t-amber-400 border-x border-b border-white/20 shadow-[0_0_20px_rgba(251,191,36,0.18)] backdrop-blur-md' 
                      : 'bg-slate-900/70 backdrop-blur-md border border-white/10 shadow-xl shadow-black/85 hover:bg-slate-900/75'
                  }`}
                >
                  {/* Active Indicator Pin */}
                  {isToday && (
                    <div className="absolute -top-2.5 md:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[9px] md:text-[10px] font-black uppercase px-3 py-0.5 rounded-full tracking-widest shadow-lg flex items-center gap-1 border border-amber-300">
                      <Flame size={9} className="animate-bounce" />
                      <span>TODAY</span>
                    </div>
                  )}

                  {/* Day Header */}
                  <div className={`p-4 md:p-5 border-b text-center rounded-t-[1.5rem] md:rounded-t-[2rem] ${
                    isToday 
                      ? 'bg-amber-400/10 border-white/10' 
                      : 'bg-slate-950/50 border-white/5'
                  }`}>
                    <span className={`block text-lg md:text-xl uppercase font-bold tracking-tight ${
                      isToday ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'text-white'
                    }`}>
                      {dayLabel}
                    </span>
                    <span className="text-[10px] md:text-xs font-extrabold font-mono mt-1 inline-block text-slate-400 leading-none">
                      {dateStr.split('-')[1]}/{dayNum}
                    </span>
                  </div>

                  {/* Meal Content - centered vertically & horizontally */}
                  <div className="flex-grow py-4 md:py-5 px-3 md:px-4.5 flex flex-col justify-evenly gap-3 overflow-hidden text-center items-center">
                    
                    {/* LUNCH - Gold ☀️ */}
                    <div className="space-y-1 flex-grow flex flex-col justify-center items-center text-center w-full">
                      <span className="text-xs md:text-base lg:text-lg font-black uppercase text-amber-400 tracking-widest leading-none flex items-center gap-1">
                        <span>☀️ LUNCH</span>
                      </span>
                      {lunchName ? (
                        <div className="flex flex-col justify-center items-center text-center">
                          <p className="text-base md:text-lg lg:text-[22px] font-black text-white leading-tight uppercase tracking-tight line-clamp-3">
                            {lunchName}
                          </p>
                          {lunchSide && (
                            <div className="mt-1.5 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
                              <span className="text-[9px] md:text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">
                                🥗 SIDE: {lunchSide}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-650 italic uppercase tracking-wider">No service</p>
                      )}
                    </div>

                    {/* Horizontal Separator */}
                    <div className="border-t border-white/10 w-full" />

                    {/* DINNER - Silver/Indigo 🌙 */}
                    <div className="space-y-1 flex-grow flex flex-col justify-center items-center text-center w-full">
                      <span className="text-xs md:text-base lg:text-lg font-black uppercase text-indigo-300 tracking-widest leading-none flex items-center gap-1">
                        <span>🌙 DINNER</span>
                      </span>
                      {dinnerName ? (
                        <div className="flex flex-col justify-center items-center text-center">
                          <p className="text-base md:text-lg lg:text-[22px] font-black text-white leading-tight uppercase tracking-tight line-clamp-3">
                            {dinnerName}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-650 italic uppercase tracking-wider">No service</p>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-4 pt-4 pb-2 border-t border-white/5 flex flex-col gap-2 md:flex-row justify-between items-center text-[10px] md:text-sm font-medium text-white/50 flex-shrink-0 uppercase tracking-widest relative z-10">
        <span>Designed By Jordi CR</span>
        <span className="flex items-center gap-2 text-emerald-400/70 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-xl">
          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse" />
          Realtime kitchen synchronization active
        </span>
      </footer>

    </div>
  );
}
