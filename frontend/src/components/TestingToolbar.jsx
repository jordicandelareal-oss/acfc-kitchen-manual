import React, { useState } from 'react';
import { Play, RotateCcw, AlertTriangle, Calendar, Sparkles, X } from 'lucide-react';
import { simularCierreTurno, resetearEntornoPruebas } from '../api';

export default function TestingToolbar({ onRefresh }) {
  const [isOpen, setIsOpen] = useState(false);
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
      {/* Testing Toolbar Floating Trigger or Panel */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-[1000] flex items-center gap-2 px-3.5 py-2.5 bg-slate-900/95 hover:bg-slate-800 backdrop-blur-md text-amber-400 border border-slate-700/60 rounded-full shadow-2xl transition-all hover:scale-105 duration-200"
          title="Abrir herramientas de prueba"
        >
          <Sparkles size={18} className="animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">Test Tools</span>
        </button>
      ) : (
        <div className="fixed bottom-4 right-4 z-[1000] w-[90%] sm:w-[360px] max-w-[95vw] animate-fade-in select-none">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 text-white">
            
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Sparkles size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block leading-none">Testing Toolbar</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Control Sandbox</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content / Controls */}
            <div className="space-y-3">
              {/* Date selection */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Fecha de Simulación</label>
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
                  <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent text-white font-medium outline-none text-xs w-full"
                  />
                </div>
              </div>

              {/* Simulation buttons */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  onClick={() => handleRunShift('lunch')}
                  disabled={loadingAction !== null}
                  className="w-full px-3 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                  title="Ejecuta manualmente el descuento de stock para el almuerzo del día seleccionado"
                >
                  <Play size={12} className="fill-current" />
                  <span>{loadingAction === 'lunch' ? 'Procesando...' : 'Simular Cierre: Comida'}</span>
                </button>

                <button
                  onClick={() => handleRunShift('dinner')}
                  disabled={loadingAction !== null}
                  className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                  title="Ejecuta manualmente el descuento de stock para la cena del día seleccionado"
                >
                  <Play size={12} className="fill-current" />
                  <span>{loadingAction === 'dinner' ? 'Procesando...' : 'Simular Cierre: Cena'}</span>
                </button>

                <button
                  onClick={() => setConfirmResetOpen(true)}
                  disabled={loadingAction !== null}
                  className="w-full px-3 py-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 mt-1"
                  title="Restablece a 0 stock_actual y stock_reservado y borra asignaciones de menu_planner"
                >
                  <RotateCcw size={12} />
                  <span>{loadingAction === 'reset' ? 'Reseteando...' : 'Resetear Entorno Sandbox'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

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
