import React, { useEffect, useRef, useState, useCallback } from 'react';

// Safe global call helper
function callGlobal(name, ...args) {
  if (typeof window[name] === 'function') return window[name](...args);
}

// Audit Console — captures window.addPlannerAuditLog into React state
function AuditConsole() {
  const logRef = useRef(null);
  const [logs, setLogs] = useState([
    { type: 'info', msg: '[SISTEMA] Consola iniciada. Esperando eventos...' }
  ]);

  useEffect(() => {
    window.addPlannerAuditLog = (msg, type = 'info') => {
      const ts = new Date().toLocaleTimeString();
      setLogs(prev => [...prev, { type, msg, ts }].slice(-300));
    };
    return () => {
      window.addPlannerAuditLog = (msg) => console.log('[PLANNER]', msg);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const colorClass = (type) => {
    if (type === 'error') return 'text-red-400 font-semibold';
    if (type === 'warn')  return 'text-amber-500 font-semibold';
    if (type === 'success') return 'text-green-400 font-bold';
    return 'text-slate-300';
  };

  const e = React.createElement;
  return e('div', { className: 'xl:col-span-1 border border-slate-800 rounded-xl bg-slate-900 overflow-hidden shadow-xl flex flex-col h-full min-h-[400px]' },
    e('div', { className: 'flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 flex-shrink-0' },
      e('div', { className: 'flex items-center gap-2' },
        e('span', { className: 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse' }),
        e('h4', { className: 'text-xs font-bold text-slate-200 uppercase tracking-widest' }, '🛠️ Diagnóstico')
      ),
      e('button', {
        onClick: () => setLogs([{ type: 'info', msg: '[INFO] Consola vacía. Listo para auditar.' }]),
        className: 'text-[10px] text-slate-400 hover:text-slate-200 underline transition-colors font-semibold'
      }, 'Limpiar')
    ),
    e('div', { className: 'p-3 flex-grow overflow-hidden flex flex-col' },
      e('div', {
        ref: logRef,
        id: 'live-audit-logs',
        className: 'flex-grow overflow-y-auto font-mono text-[11px] space-y-1.5 pr-2 leading-relaxed',
        style: { maxHeight: 480 }
      },
        logs.map((l, i) =>
          e('p', { key: i, className: colorClass(l.type) },
            l.ts && e('span', { className: 'text-slate-500' }, '[' + l.ts + '] '),
            l.msg
          )
        )
      )
    )
  );
}

// Calendar Grid Shell — #cal-grid and mobile containers filled by window.renderCalendar()
function CalendarGrid() {
  const DAY_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const e = React.createElement;

  return e('div', { className: 'xl:col-span-3 space-y-4' },
    // Legend
    e('div', { className: 'flex flex-wrap gap-4 text-xs text-slate-500' },
      e('div', { className: 'flex items-center gap-1.5' },
        e('span', { className: 'w-3 h-3 rounded-full bg-brand inline-block' }), 'Hoy'
      ),
      e('div', { className: 'flex items-center gap-1.5' },
        e('span', { className: 'w-3 h-3 rounded bg-brand-muted border border-brand/30 inline-block' }), 'Menú planificado'
      ),
      e('div', { className: 'flex items-center gap-1.5' },
        e('span', { className: 'w-3 h-3 rounded bg-white border border-slate-200 inline-block' }), 'Sin planificar'
      )
    ),
    // Desktop day-of-week headers
    e('div', { className: 'hidden md:grid grid-cols-7 gap-2' },
      ...DAY_LABELS.map(d =>
        e('div', { key: d, className: 'text-center text-xs font-semibold text-slate-400 uppercase py-1' }, d)
      )
    ),
    // Desktop grid — filled by window.renderCalendar()
    e('div', { className: 'hidden md:grid grid-cols-7 gap-2', id: 'cal-grid' }),
    // Mobile planner
    e('div', { className: 'md:hidden mt-4 space-y-3' },
      e('div', { className: 'flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit' },
        e('button', {
          id: 'mob-view-week-btn',
          onClick: () => callGlobal('setMobilePlannerView', 'week'),
          className: 'px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-indigo-600 text-white shadow-sm'
        }, 'Semana'),
        e('button', {
          id: 'mob-view-month-btn',
          onClick: () => callGlobal('setMobilePlannerView', 'month'),
          className: 'px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-800'
        }, 'Mes')
      ),
      e('div', { id: 'mob-week-view' },
        e('div', { id: 'mobile-day-tabs', className: 'grid grid-cols-7 gap-1 mb-3' }),
        e('div', { id: 'mobile-day-panel', className: 'transition-all duration-200 ease-in-out' })
      ),
      e('div', { id: 'mob-month-view', className: 'hidden' },
        e('div', { id: 'cal-list-mobile', className: 'grid grid-cols-7 gap-1' })
      )
    )
  );
}

// Toolbar — calls window globals for all actions
function PlannerToolbar({ selectedWeeks, onWeekToggle }) {
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving]         = useState(false);

  const handleGenerate = async () => {
    if (selectedWeeks.length === 0) {
      callGlobal('toast', '⚠️ Selecciona al menos una semana antes de generar');
      return;
    }
    setGenerating(true);
    try { await callGlobal('generateWeeklyMenu', selectedWeeks); }
    finally { setGenerating(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try { await callGlobal('saveAndConfirmMenuUI'); }
    finally { setSaving(false); }
  };

  const e = React.createElement;
  const Icon = ({ name }) => e('span', { className: 'material-symbols-outlined', style: { fontSize: 16 } }, name);

  return e('div', { className: 'flex flex-wrap justify-between items-center gap-4' },
    e('div', null,
      e('h1', { className: 'text-3xl font-bold text-slate-900', style: { fontFamily: 'Outfit' } }, 'Planificador Mensual'),
      e('p', { className: 'text-sm text-slate-500 mt-1' }, 'Julio 2026 — Menú diario almuerzo + cena')
    ),
    e('div', { className: 'flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0' },
      // Menu settings
      e('button', {
        onClick: () => callGlobal('openMenuSettingsModal'),
        className: 'flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 bg-white rounded-xl text-xs font-semibold hover:border-brand hover:text-brand hover:shadow-sm transition-all whitespace-nowrap'
      }, e(Icon, { name: 'settings' }), ' Ajustes de Menú'),
      // Reset
      e('button', {
        onClick: () => callGlobal('openResetPlannerModal'),
        className: 'border border-red-200 text-red-600 bg-white hover:bg-red-50 font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-xs whitespace-nowrap'
      }, e(Icon, { name: 'delete_sweep' }), ' Resetear'),
      // Week selector
      e('div', { className: 'flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200' },
        e('span', { className: 'text-[10px] font-bold text-slate-500 uppercase px-2' }, 'Sem:'),
        ...[1,2,3,4].map(w =>
          e('label', { key: w, className: 'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-200 transition-colors' },
            e('input', {
              type: 'checkbox', name: 'generate-week-main', value: String(w),
              checked: selectedWeeks.includes(w),
              onChange: () => onWeekToggle(w),
              className: 'rounded border-slate-300 text-brand focus:ring-brand w-3.5 h-3.5'
            }),
            e('span', null, String(w))
          )
        )
      ),
      // Auto-generate
      e('button', {
        id: 'planner-generate-btn',
        onClick: handleGenerate,
        disabled: generating,
        className: 'flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-semibold hover:-translate-y-0.5 transition-all whitespace-nowrap disabled:opacity-60'
      },
        generating
          ? e('span', { className: 'material-symbols-outlined animate-spin', style: { fontSize: 16 } }, 'progress_activity')
          : e('span', { id: 'planner-generate-icon', className: 'material-symbols-outlined', style: { fontSize: 16 } }, 'bolt'),
        e('span', { id: 'planner-generate-text' }, generating ? 'Generando...' : 'Generar Menú Semanal')
      ),
      // Save & discount stock
      e('button', {
        id: 'planner-save-all-btn',
        onClick: handleSave,
        disabled: saving,
        className: 'flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:-translate-y-0.5 transition-all whitespace-nowrap disabled:opacity-60'
      },
        saving
          ? e('span', { className: 'material-symbols-outlined animate-spin', style: { fontSize: 16 } }, 'progress_activity')
          : e('span', { id: 'planner-save-all-icon', className: 'material-symbols-outlined', style: { fontSize: 16 } }, 'save'),
        e('span', { id: 'planner-save-all-text' }, saving ? 'Procesando...' : '💾 Guardar Menú y Descontar Stock')
      ),
      // Shopping list
      e('button', {
        onClick: () => callGlobal('calculateShoppingList'),
        className: 'flex items-center gap-1.5 px-3 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition-all whitespace-nowrap'
      }, e(Icon, { name: 'shopping_cart' }), 'Lista compra'),
      // Month nav
      e('div', { className: 'flex items-center gap-1 ml-2 flex-shrink-0' },
        e('button', {
          onClick: () => callGlobal('toast', '⬅️ Navegación de mes'),
          className: 'p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500'
        }, e(Icon, { name: 'chevron_left' })),
        e('span', { className: 'font-semibold text-slate-700 text-xs px-1' }, 'Jul 2026'),
        e('button', {
          onClick: () => callGlobal('toast', '➡️ Navegación de mes'),
          className: 'p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500'
        }, e(Icon, { name: 'chevron_right' }))
      )
    )
  );
}

// PlannerTab root
export default function PlannerTab() {
  const [selectedWeeks, setSelectedWeeks] = useState([1]);

  const handleWeekToggle = (w) =>
    setSelectedWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);

  // After mounting, patch renderCalendar to keep React in sync
  useEffect(() => {
    const origRender = window.renderCalendar;
    window.renderCalendar = function (...args) {
      if (origRender) origRender(...args);
    };
    window.refreshReactPlanner = () => {};

    // Trigger first render now that DOM containers exist
    if (origRender) origRender();

    return () => {
      if (origRender) window.renderCalendar = origRender;
    };
  }, []);

  const e = React.createElement;
  return e('div', { className: 'w-full flex flex-col gap-4' },
    e(PlannerToolbar, { selectedWeeks, onWeekToggle: handleWeekToggle }),
    e('div', { className: 'grid grid-cols-1 xl:grid-cols-4 gap-5 items-start' },
      e(CalendarGrid),
      e(AuditConsole)
    )
  );
}
