/**
 * NotificationsPanel.jsx
 * Panel de notificaciones colapsables con:
 *  - Acordeón por categorías (Alertas de Stock, Menú/Planificador, Proveedores)
 *  - Navegación directa (deep-link) al problema al hacer clic
 *  - Swipe-to-dismiss + botón X táctil
 *  - Persistencia por usuario en localStorage (acfc_dismissed_<userId>)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDismissedKey(userId) {
  return `acfc_dismissed_${userId || 'anon'}`;
}

function loadDismissed(userId) {
  try {
    const raw = localStorage.getItem(getDismissedKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDismissed(userId, ids) {
  try {
    localStorage.setItem(getDismissedKey(userId), JSON.stringify(ids));
  } catch { /* silent */ }
}

// ─── Swipe-able Notification Row ────────────────────────────────────────────

function NotifRow({ notif, onDismiss, onClick }) {
  const [startX, setStartX] = useState(null);
  const [offsetX, setOffsetX] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const rowRef = useRef(null);

  const handleTouchStart = (e) => setStartX(e.touches[0].clientX);
  const handleTouchMove = (e) => {
    if (startX === null) return;
    const dx = e.touches[0].clientX - startX;
    if (dx < 0) setOffsetX(dx); // solo izquierda
  };
  const handleTouchEnd = () => {
    if (offsetX < -80) {
      triggerDismiss();
    } else {
      setOffsetX(0);
    }
    setStartX(null);
  };

  const triggerDismiss = () => {
    setDismissing(true);
    setTimeout(() => onDismiss(notif.id), 280);
  };

  const severityStyles = {
    critical: 'bg-red-50 border-red-200',
    warning:  'bg-amber-50 border-amber-200',
    info:     'bg-blue-50 border-blue-200',
    ok:       'bg-emerald-50 border-emerald-200',
  };
  const iconMap = {
    critical: '🔴',
    warning:  '🟡',
    info:     '🔵',
    ok:       '🟢',
  };

  return (
    <div
      ref={rowRef}
      className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${severityStyles[notif.severity] || severityStyles.info}`}
      style={{
        transform: dismissing ? 'translateX(-110%)' : `translateX(${offsetX}px)`,
        opacity: dismissing ? 0 : 1,
        transition: dismissing ? 'transform 0.28s ease, opacity 0.28s ease' : 'transform 0.1s ease',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-start gap-2.5 p-3 cursor-pointer" onClick={() => onClick(notif)}>
        <span className="text-base flex-shrink-0 mt-0.5">{iconMap[notif.severity] || '🔵'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 leading-tight">{notif.title}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{notif.body}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); triggerDismiss(); }}
          className="flex-shrink-0 p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          title="Descartar"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
    </div>
  );
}

// ─── Accordion Category ───────────────────────────────────────────────────────

function CategoryAccordion({ category, notifs, onDismiss, onNotifClick, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{category.icon}</span>
          <span className="text-xs font-bold text-slate-700">{category.label}</span>
          {notifs.length > 0 && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-black rounded-full leading-none">
              {notifs.length}
            </span>
          )}
        </div>
        <span
          className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ fontSize: 18 }}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="p-2 space-y-1.5 bg-white">
          {notifs.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic text-center py-3">Sin incidencias activas.</p>
          ) : (
            notifs.map(n => (
              <NotifRow
                key={n.id}
                notif={n}
                onDismiss={onDismiss}
                onClick={onNotifClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export default function NotificationsPanel({
  isOpen,
  onClose,
  userId,
  role,
  lowStockAlerts = [],
  onNavigate,
}) {
  const [dismissed, setDismissed] = useState([]);
  const [plannerAlerts, setPlannerAlerts] = useState([]);
  const [supplierAlerts, setSupplierAlerts] = useState([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  // Cargar descartados del perfil actual
  useEffect(() => {
    setDismissed(loadDismissed(userId));
  }, [userId]);

  // Cargar alertas adicionales de Supabase (planificador + proveedores)
  useEffect(() => {
    if (!isOpen) return;
    setLoadingExtra(true);
    const run = async () => {
      try {
        // Menús sin receta asignada (días en el planificador sin lunch_recipe_id ni dinner_recipe_id)
        const today = new Date();
        const todayISO = today.toISOString().split('T')[0];
        const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

        const { data: menus } = await supabase
          .from('menus')
          .select('id, date, lunch_recipe_id, dinner_recipe_id')
          .gte('date', todayISO)
          .lte('date', in7Days);

        const plannerIssues = (menus || []).flatMap(m => {
          const issues = [];
          if (!m.lunch_recipe_id) issues.push({
            id: `planner-lunch-${m.date}`,
            title: `Almuerzo sin receta — ${m.date}`,
            body: 'El menú de almuerzo de este día no tiene receta asignada.',
            severity: 'warning',
            action: { tab: 'planner', date: m.date },
          });
          if (!m.dinner_recipe_id) issues.push({
            id: `planner-dinner-${m.date}`,
            title: `Cena sin receta — ${m.date}`,
            body: 'El menú de cena de este día no tiene receta asignada.',
            severity: 'warning',
            action: { tab: 'planner', date: m.date },
          });
          return issues;
        });
        setPlannerAlerts(plannerIssues);

        // Proveedores sin email / teléfono
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id, name, email, phone');

        const suppIssues = (suppliers || [])
          .filter(s => !s.email && !s.phone)
          .map(s => ({
            id: `supplier-missing-${s.id}`,
            title: `Proveedor sin contacto: ${s.name}`,
            body: 'No tiene email ni teléfono registrado.',
            severity: 'info',
            action: { tab: 'suppliers', supplierId: s.id },
          }));
        setSupplierAlerts(suppIssues);

      } catch (e) {
        console.error('[Notifications] Error cargando alertas extra:', e);
      } finally {
        setLoadingExtra(false);
      }
    };
    run();
  }, [isOpen]);

  // Construir alertas de stock desde lowStockAlerts prop
  const stockNotifs = lowStockAlerts.map(a => ({
    id: `stock-${a.id}`,
    title: `${a.name} — Stock bajo`,
    body: `Actual: ${Number(a.stock_actual).toFixed(1)} ${a.unit} · Mínimo: ${Number(a.stock_minimo).toFixed(1)} ${a.unit}`,
    severity: Number(a.stock_actual) <= 0 ? 'critical' : 'warning',
    action: { tab: 'inventory', ingredientId: a.id },
  }));

  // Filtrar descartados
  const filter = (list) => list.filter(n => !dismissed.includes(n.id));

  const visibleStock = filter(stockNotifs);
  const visiblePlanner = filter(plannerAlerts);
  const visibleSuppliers = filter(supplierAlerts);
  const totalUnread = visibleStock.length + visiblePlanner.length + visibleSuppliers.length;

  // Descartar notificación
  const handleDismiss = useCallback((id) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    saveDismissed(userId, updated);
  }, [dismissed, userId]);

  // Marcar todas como descartadas
  const handleDismissAll = () => {
    const allIds = [...visibleStock, ...visiblePlanner, ...visibleSuppliers].map(n => n.id);
    const updated = [...new Set([...dismissed, ...allIds])];
    setDismissed(updated);
    saveDismissed(userId, updated);
  };

  // Navegación directa al problema
  const handleNotifClick = (notif) => {
    if (!notif.action) return;
    onNavigate(notif.action.tab);
    onClose();
    // Pasar contexto al módulo destino via window
    if (notif.action.ingredientId) {
      window._notif_focus_ingredient = notif.action.ingredientId;
    }
    if (notif.action.date) {
      window._notif_focus_date = notif.action.date;
    }
    if (notif.action.supplierId) {
      window._notif_focus_supplier = notif.action.supplierId;
    }
  };

  const CATEGORIES = [
    {
      id: 'stock',
      icon: '🚨',
      label: 'Alertas de Stock',
      notifs: visibleStock,
    },
    {
      id: 'planner',
      icon: '📅',
      label: 'Menú y Planificador',
      notifs: visiblePlanner,
    },
    ...(role !== 'assistant' ? [{
      id: 'suppliers',
      icon: '🚛',
      label: 'Proveedores y Pedidos',
      notifs: visibleSuppliers,
    }] : []),
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-start justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Overlay semitransparente */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel lateral derecho */}
      <div className="relative z-10 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="material-symbols-outlined text-brand" style={{ fontSize: 22 }}>notifications</span>
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
                Centro de Notificaciones
              </h3>
              <p className="text-[10px] text-slate-400">
                {totalUnread === 0 ? 'Todo al día ✅' : `${totalUnread} incidencia${totalUnread !== 1 ? 's' : ''} activa${totalUnread !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {totalUnread > 0 && (
              <button
                onClick={handleDismissAll}
                className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Marcar todas como leídas"
              >
                Limpiar todo
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingExtra && (
            <p className="text-[10px] text-slate-400 italic text-center py-2">
              Verificando incidencias en tiempo real...
            </p>
          )}

          {totalUnread === 0 && !loadingExtra ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <span className="text-5xl">✅</span>
              <p className="text-sm font-bold text-slate-700">Todo al día</p>
              <p className="text-xs text-slate-400">No hay alertas ni incidencias activas en este momento.</p>
            </div>
          ) : (
            CATEGORIES.map((cat, idx) => (
              <CategoryAccordion
                key={cat.id}
                category={cat}
                notifs={cat.notifs}
                onDismiss={handleDismiss}
                onNotifClick={handleNotifClick}
                defaultOpen={idx === 0}
              />
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <p className="text-[10px] text-slate-400 text-center">
            ← Desliza para descartar · Toca para ir al problema
          </p>
        </div>
      </div>
    </div>
  );
}
