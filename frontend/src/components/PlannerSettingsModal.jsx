import React, { useState, useEffect } from 'react';
import { X, Settings, ShieldCheck, HelpCircle } from 'lucide-react';
import { PLANNER_RULES } from '../utils/plannerRules';

export default function PlannerSettingsModal({ isOpen, onClose, onSave }) {
  // Store user-defined editable settings in local state
  const [editableSettings, setEditableSettings] = useState({});

  // Sync state with localStorage and rules schema when opened
  useEffect(() => {
    if (isOpen) {
      const activeValues = {};
      PLANNER_RULES.usuario.forEach(rule => {
        const stored = localStorage.getItem(rule.key);
        if (stored !== null) {
          activeValues[rule.key] = rule.type === 'boolean' ? stored === 'true' : Number(stored);
        } else {
          activeValues[rule.key] = rule.defaultValue;
        }
      });
      setEditableSettings(activeValues);
    }
  }, [isOpen]);

  const handleChange = (key, value) => {
    setEditableSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    Object.entries(editableSettings).forEach(([key, val]) => {
      localStorage.setItem(key, val);
    });
    
    if (onSave) onSave();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="text-brand animate-spin-slow" size={22} />
            <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Ajustes del Generador</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="space-y-6 overflow-y-auto flex-1 pr-2 pb-4">
          
          {/* SECCIÓN 1: Reglas de Configuración Fija */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 border-b border-slate-100 font-semibold p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" /> Configuración Fija (Nutricional)
              </span>
            </div>
            <div className="p-3 divide-y divide-slate-100">
              {PLANNER_RULES.sistema.map(rule => (
                <div key={rule.key} className="py-2.5 flex justify-between items-start gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-700">{rule.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{rule.desc}</span>
                  </div>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-bold text-xs rounded-lg flex-shrink-0">
                    {rule.value} / sem
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN 2: Reglas Personalizables */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 border-b border-slate-100 font-semibold p-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                ⚙️ Reglas Personalizables (Ajustes de Usuario)
              </span>
            </div>
            <div className="p-4 space-y-4">
              {PLANNER_RULES.usuario.map(rule => {
                const currentValue = editableSettings[rule.key];
                
                return (
                  <div key={rule.key} className="flex justify-between items-center gap-4 py-2 border-b border-slate-50 last:border-b-0">
                    <div className="flex flex-col flex-grow">
                      <span className="text-xs font-semibold text-slate-700">{rule.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{rule.desc}</span>
                    </div>

                    <div className="flex-shrink-0">
                      {/* RENDER BOOLEAN (TOGGLE SWITCH) */}
                      {rule.type === 'boolean' && (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!currentValue}
                            onChange={(e) => handleChange(rule.key, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                        </label>
                      )}

                      {/* RENDER NUMBER (INPUT BOX) */}
                      {rule.type === 'number' && (
                        <input 
                          type="number" 
                          value={currentValue !== undefined ? currentValue : rule.defaultValue}
                          onChange={(e) => handleChange(rule.key, Number(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none text-center bg-white"
                          min="0"
                          max="7"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
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
