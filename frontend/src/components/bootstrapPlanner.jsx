import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import PlannerTab from './PlannerTab.jsx';

/**
 * PlannerLoader — waits until the legacy init() in index.html has:
 *   1. Loaded recipes into window.ALL_RECIPES (length > 0)
 *   2. Finished the planner fetch (window.PLANNER_LOADING === false)
 *
 * Polls every 200ms. Shows an error after 5s if data never arrives.
 */
function PlannerLoader() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    const startTime = Date.now();

    const isReady = () => {
      const recs = window.ALL_RECIPES || window.RECIPES;
      const recsOk = Array.isArray(recs) && recs.length > 0;
      // PLANNER_LOADING starts as true and is set to false once fetchPlannerData resolves.
      // Accept false OR undefined (in case PLANNER_LOADING was not yet set to true either).
      const plannerDone = window.PLANNER_LOADING === false;
      return recsOk && plannerDone;
    };

    // Fast path: already ready synchronously
    if (isReady()) {
      setStatus('ready');
      return;
    }

    const interval = setInterval(() => {
      if (isReady()) {
        clearInterval(interval);
        setStatus('ready');
      } else if (Date.now() - startTime > 5000) {
        clearInterval(interval);
        setStatus('error');
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  if (status === 'error') {
    return React.createElement('div', {
      className: 'p-10 text-center flex flex-col items-center gap-3 border border-red-200 rounded-2xl bg-red-50/50'
    },
      React.createElement('span', { className: 'material-symbols-outlined text-4xl text-red-400' }, 'error'),
      React.createElement('p', { className: 'font-semibold text-red-600 text-sm' },
        'Error de carga: Revisa la conexión con la base de datos.'
      ),
      React.createElement('button', {
        onClick: () => window.location.reload(),
        className: 'px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors'
      }, 'Reintentar (recargar página)')
    );
  }

  if (status === 'loading') {
    return React.createElement('div', {
      className: 'p-10 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2'
    },
      React.createElement('span', {
        className: 'material-symbols-outlined animate-spin text-indigo-600 text-2xl'
      }, 'progress_activity'),
      React.createElement('p', { className: 'font-semibold text-slate-700' },
        'Cargando datos del planificador...'
      )
    );
  }

  return React.createElement(PlannerTab);
}

const container = document.getElementById('screen-planner');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(PlannerLoader));
}
