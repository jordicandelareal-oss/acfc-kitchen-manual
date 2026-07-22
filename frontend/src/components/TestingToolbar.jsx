import React, { useState } from 'react';
import { Play, RotateCcw, AlertTriangle, CheckCircle, ChevronUp, ChevronDown, Calendar, Sparkles } from 'lucide-react';
import { simularCierreTurno, resetearEntornoPruebas } from '../api';

export default function TestingToolbar({ onRefresh }) {
  const [minimized, setMinimized] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [loadingAction, setLoadingAction] = useState(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleRunShift = async (shift) => {
    if (!selectedDate) {
      if (window.toast) window.toast('⚠️ Selecciona una fecha para simular');
      return;
    }
    const label = shift === 'lunch' ? 'Comida' : 'Cena';
    setLoadingAction(shift);
    try {
      const res = await simularCierreTurno(selectedDate, shift);
      if (res.error) throw res.error;

      const data = res.data || {};
      if (data.success) {
        if (window.toast) window.toast(`✅ Cierre de Turno (${label}) ejecutado correctamente para ${selectedDate}`);
        if (onRefresh) onRefresh();
      } else {
        if (window.toast) window.toast(`⚠️ ${data.message || 'No se pudo procesar el cierre de turno'}`);
      }
    } catch (err) {
      console.error(err);
      if (window.toast) window.toast(`❌ Error en simulación de ${label}: ` + err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetSandbox = async () => {
    setLoadingAction('reset');
    try {
      const res = await resetearEntornoPruebas();
      if (res.error) throw res.error;

      if (window.toast) window.toast('🔄 Entorno de pruebas reseteado correctamente (Stock a 0 y planificador limpio)');
      setConfirmResetOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      if (window.toast) window.toast('❌ Error al resetear entorno de pruebas: ' + err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <>
      {/* Testing Toolbar Floating Panel */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-[95%] max-w-4xl animate-slide-up select-none">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-3 sm:p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block leading-none">Testing Toolbar</span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">Simulación & Control de Entorno Sandbox</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Controles cuando desplegado */}
              {!minimized && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Selector de fecha */}
                  <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
                    <Calendar size={14} className="text-slate-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="bg-transparent text-white font-medium outline-none text-xs"
                    />
                  </div>

                  {/* Botón Simular Cierre Turno: Comida */}
                  <button
                    onClick={() => handleRunShift('lunch')}
                    disabled={loadingAction !== null}
                    className="px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    title="Ejecuta manualmente el descuento de stock para el almuerzo del día seleccionado"
                  >
                    <Play size={14} className="fill-current" />
                    <span>{loadingAction === 'lunch' ? 'Procesando...' : '⏩ Simular Cierre: Comida'}</span>
                  </button>

                  {/* Botón Simular Cierre Turno: Cena */}
                  <button
                    onClick={() => handleRunShift('dinner')}
                    disabled={loadingAction !== null}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    title="Ejecuta manualmente el descuento de stock para la cena del día seleccionado"
                  >
                    <Play size={14} className="fill-current" />
                    <span>{loadingAction === 'dinner' ? 'Procesando...' : '⏩ Simular Cierre: Cena'}</span>
                  </button>

                  {/* Botón Resetear Entorno de Pruebas */}
                  <button
                    onClick={() => setConfirmResetOpen(true)}
                    disabled={loadingAction !== null}
                    className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    title="Restablece a 0 stock_actual y stock_reservado y borra asignaciones de menu_planner"
                  >
                    <RotateCcw size={14} />
                    <span>{loadingAction === 'reset' ? 'Reseteando...' : '🔄 Resetear Entorno'}</span>
                  </button>
                </div>
              )}

              {/* Botón Minimizar / Maximizar */}
              <button
                onClick={() => setMinimized(!minimized)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title={minimized ? 'Expandir barra de pruebas' : 'Minimizar barra de pruebas'}
              >
                {minimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Confirmación de Reset Sandbox */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={e => e.target === e.currentTarget && setConfirmResetOpen(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white animate-fade-in">
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
              <h3 className="font-bold text-base text-white">Resetear Entorno de Pruebas</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Esta acción pondrá a <strong>0</strong> el <code className="text-rose-400">stock_actual</code> y <code className="text-rose-400">stock_reservado</code> de todos los ingredientes y limpiará la tabla de <code className="text-rose-400">menu_planner</code>.
              <br /><br />
              ¿Confirmas que deseas dejar el sandbox 100% limpio?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetSandbox}
                disabled={loadingAction === 'reset'}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw size={15} />
                <span>Confirmar Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
