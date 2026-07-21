import React from 'react';
import { Bell, AlertTriangle, Shield } from 'lucide-react';

export function NewItemModal({ isOpen, onClose, onNavigate }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Crear nuevo elemento</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">¿Qué tipo de recurso deseas añadir al sistema?</p>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => { onClose(); onNavigate('inventory'); if (typeof window.toast === 'function') window.toast('🥦 Añade un ingrediente en la sección Inventario'); }}
            className="flex flex-col items-center gap-2 p-5 border border-slate-200 rounded-xl hover:border-brand hover:bg-brand-muted transition-all group"
          >
            <span className="material-symbols-outlined text-3xl text-brand">inventory_2</span>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-brand">Ingrediente</span>
          </button>
          <button 
            onClick={() => { onClose(); onNavigate('recipes'); if (typeof window.toast === 'function') window.toast('📋 Añade una receta en Escandallos'); }}
            className="flex flex-col items-center gap-2 p-5 border border-slate-200 rounded-xl hover:border-brand hover:bg-brand-muted transition-all group"
          >
            <span className="material-symbols-outlined text-3xl text-brand">receipt_long</span>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-brand">Receta</span>
          </button>
          <button 
            onClick={() => { onClose(); onNavigate('suppliers'); if (typeof window.toast === 'function') window.toast('🚚 Añade un proveedor en el directorio'); }}
            className="flex flex-col items-center gap-2 p-5 border border-slate-200 rounded-xl hover:border-success hover:bg-success-light transition-all group"
          >
            <span className="material-symbols-outlined text-3xl text-success">local_shipping</span>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-success">Proveedor</span>
          </button>
          <button 
            onClick={() => { onClose(); onNavigate('planner'); if (typeof window.toast === 'function') window.toast('📅 Planifica el menú en el Planificador'); }}
            className="flex flex-col items-center gap-2 p-5 border border-slate-200 rounded-xl hover:border-warn hover:bg-warn-light transition-all group"
          >
            <span className="material-symbols-outlined text-3xl text-warn">calendar_month</span>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-warn">Menú del día</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationsModal({ isOpen, onClose, lowStockAlerts = [] }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-brand" />
            <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Centro de Notificaciones</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {lowStockAlerts.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6 italic">No tienes nuevas notificaciones.</p>
          ) : (
            lowStockAlerts.map(alert => (
              <div key={alert.id} className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">{alert.name} bajo de stock</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Stock actual: {alert.stock_actual} {alert.unit} (Mín: {alert.stock_minimo} {alert.unit})
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({ isOpen, onClose, role, setRole }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box w-full max-w-md flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-5 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>⚙️ Configuración del Sistema</h3>
            <p className="text-xs text-slate-400 mt-0.5">Establece preferencias globales de la cocina</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
              <Shield size={13} className="text-brand" />
              <span>Perfil de Acceso Activo</span>
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button 
                onClick={() => {
                  setRole('jefe_cocina');
                  localStorage.setItem('acfc_user_role', 'jefe_cocina');
                  if (typeof window.toast === 'function') window.toast('👤 Perfil cambiado a Jefe de Cocina');
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${role === 'jefe_cocina' ? 'bg-white border-slate-200 text-slate-800 shadow-sm' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                Jefe de Cocina
              </button>
              <button 
                onClick={() => {
                  setRole('administrador');
                  localStorage.setItem('acfc_user_role', 'administrador');
                  if (typeof window.toast === 'function') window.toast('👤 Perfil cambiado a Administrador');
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${role === 'administrador' ? 'bg-brand border-brand text-white shadow-sm' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                Administrador
              </button>
            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
            <p className="text-xs font-bold text-slate-700">Reglas y Preferencias</p>
            <label className="flex items-center justify-between text-xs cursor-pointer select-none">
              <span className="text-slate-600 font-medium">Validación automática de stock</span>
              <input type="checkbox" defaultChecked className="rounded border-slate-300 text-brand focus:ring-brand" />
            </label>
            <label className="flex items-center justify-between text-xs cursor-pointer select-none">
              <span className="text-slate-600 font-medium">Alertas por correo de pedidos</span>
              <input type="checkbox" defaultChecked className="rounded border-slate-300 text-brand focus:ring-brand" />
            </label>
            <label className="flex items-center justify-between text-xs cursor-pointer select-none">
              <span className="text-slate-600 font-medium">Auto-guardado en la nube</span>
              <input type="checkbox" defaultChecked className="rounded border-slate-300 text-brand focus:ring-brand" />
            </label>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-slate-100 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProfileModal({ isOpen, onClose, role }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box w-full max-w-sm flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-5 flex-shrink-0">
          <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Perfil del Usuario</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="flex flex-col items-center text-center p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-white font-bold text-2xl shadow-md mb-3">CJ</div>
            <h4 className="font-bold text-slate-800 text-sm">Chef Jefe (Samir)</h4>
            <span className="px-2.5 py-0.5 bg-brand-muted text-brand text-[10px] font-bold rounded-full mt-1">
              {role === 'administrador' ? 'Administrador' : 'Jefe de Cocina'}
            </span>
          </div>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 border-b border-slate-100">
              <span className="text-slate-400 font-medium">Email</span>
              <span className="text-slate-700 font-semibold">samir.cairo@acfc.com</span>
            </div>
            <div className="flex justify-between p-2.5 border-b border-slate-100">
              <span className="text-slate-400 font-medium">Establecimiento</span>
              <span className="text-slate-700 font-semibold">ACFC Kitchen Principal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
