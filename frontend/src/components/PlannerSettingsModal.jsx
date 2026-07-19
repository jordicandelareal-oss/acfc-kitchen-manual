import React, { useState, useEffect } from 'react';
import { X, Settings, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function PlannerSettingsModal({ isOpen, onClose, onSave }) {
  const [incluirEspeciales, setIncluirEspeciales] = useState(false);
  const [menuSencilloFDS, setMenuSencilloFDS] = useState(false);
  const [maxCarneRoja, setMaxCarneRoja] = useState(2);
  const [maxPasta, setMaxPasta] = useState(2);

  // Load preferences from localStorage upon opening
  useEffect(() => {
    if (isOpen) {
      setIncluirEspeciales(localStorage.getItem('menu_setting_incluir_especiales') === 'true');
      setMenuSencilloFDS(localStorage.getItem('menu_setting_sencillo_fds') === 'true');
      setMaxCarneRoja(Number(localStorage.getItem('menu_setting_max_carne_roja')) || 2);
      setMaxPasta(Number(localStorage.getItem('menu_setting_max_pasta')) || 2);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('menu_setting_incluir_especiales', incluirEspeciales);
    localStorage.setItem('menu_setting_sencillo_fds', menuSencilloFDS);
    localStorage.setItem('menu_setting_max_carne_roja', maxCarneRoja);
    localStorage.setItem('menu_setting_max_pasta', maxPasta);
    
    if (onSave) onSave();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box max-w-md">
        <div className="flex justify-between items-center mb-5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="text-brand" size={20} />
            <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Ajustes del Generador</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Toggle: Incluir Platos Especiales */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 gap-3">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-semibold text-slate-700">Incluir platos 'Especiales'</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Permite platos de categoría premium (ej. marisco) en la autogeneración.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input 
                type="checkbox" 
                checked={incluirEspeciales}
                onChange={(e) => setIncluirEspeciales(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
            </label>
          </div>

          {/* Toggle: Menús Sencillos FDS */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 gap-3">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-semibold text-slate-700">Menús sencillos fin de semana</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Filtra platos rápidos de cocinar (&lt; 30 min) para sábados y domingos.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input 
                type="checkbox" 
                checked={menuSencilloFDS}
                onChange={(e) => setMenuSencilloFDS(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
            </label>
          </div>

          {/* Límites de carne roja y pasta */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Restricciones Nutricionales</h4>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-600 font-semibold">Máx Carne Roja / semana</span>
              <input 
                type="number" 
                value={maxCarneRoja}
                onChange={(e) => setMaxCarneRoja(Number(e.target.value) || 2)}
                className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none text-center bg-white"
                min="0"
                max="7"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-600 font-semibold">Máx Pasta / semana</span>
              <input 
                type="number" 
                value={maxPasta}
                onChange={(e) => setMaxPasta(Number(e.target.value) || 2)}
                className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none text-center bg-white"
                min="0"
                max="7"
              />
            </div>
          </div>

        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-dark rounded-xl shadow-sm transition-all">
            Guardar Ajustes
          </button>
        </div>
      </div>
    </div>
  );
}
