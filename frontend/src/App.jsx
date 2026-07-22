import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Package, Utensils, LayoutDashboard, Truck
} from 'lucide-react';
import { fetchData, fetchRecipesWithIngredients, fetchRecipes } from './api';
import SplashScreen from './SplashScreen';
import './index.css';
import { supabase } from './supabaseClient';

import DashboardTab from './components/DashboardTab';
import InventoryTab from './components/InventoryTab';
import RecipesTab from './components/RecipesTab';
import SuppliersTab from './components/SuppliersTab';
import PlannerTab from './components/PlannerTab';
import MenusTab from './components/MenusTab';
import ComprasTab from './components/ComprasTab';
import InsumosTab from './components/InsumosTab';
import TestingToolbar from './components/TestingToolbar';

import LoginScreen from './components/LoginScreen';
import {
  NewItemModal,
  SettingsModal,
  ProfileModal
} from './components/GlobalModals';
import NotificationsPanel from './components/NotificationsPanel';

function App() {
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('introPlayed');
  });
  const [userSession, setUserSession] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [month, setMonth] = useState('Julio');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  
  // Estado de Rol (RBAC) dictado estrictamente por auth.users y public.user_roles
  const [role, setRole] = useState(null);

  // Verificación de sesión real de Supabase Auth con timeout de 1.5s
  useEffect(() => {
    let isMounted = true;

    async function checkAuthSession() {
      try {
        const getSessionWithTimeout = () => {
          return Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Auth getSession timeout (1.5s)')), 1500)
            )
          ]);
        };

        const { data: { session } } = await getSessionWithTimeout();

        if (!isMounted) return;

        if (session?.user) {
          setUserSession(session.user);
          try {
            const { data: roleRow } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            const dbRole = roleRow?.role || 'assistant';
            setRole(dbRole);
            localStorage.setItem('acfc_user_role', dbRole);
            console.log('✅ Interfaz montada por defecto. Estado de sesión resolved:', {
              id: session.user.id,
              user: session.user.email,
              role: dbRole,
              status: 'authenticated'
            });
          } catch (e) {
            setRole('assistant');
            console.log('✅ Interfaz montada por defecto. Estado de sesión resolved:', {
              id: session.user.id,
              user: session.user.email,
              role: 'assistant',
              status: 'authenticated (role fallback)'
            });
          }
        } else {
          setUserSession(null);
          setRole(null);
          localStorage.removeItem('acfc_user_role');
          console.log('✅ Interfaz montada por defecto. Estado de sesión resolved:', {
            user: null,
            role: null,
            status: 'unauthenticated'
          });
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('[Auth] Timeout o error en la verificación de sesión:', err?.message || err);
        setUserSession(null);
        setRole(null);
        localStorage.removeItem('acfc_user_role');
        console.log('✅ Interfaz montada por defecto. Estado de sesión resolved:', {
          user: null,
          role: null,
          status: 'unauthenticated (timeout or error)'
        });
      } finally {
        if (isMounted) {
          setAuthChecking(false);
        }
      }
    }

    checkAuthSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        setUserSession(session.user);
        try {
          const { data: roleRow } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          const dbRole = roleRow?.role || 'assistant';
          setRole(dbRole);
          localStorage.setItem('acfc_user_role', dbRole);
        } catch (e) {
          setRole('assistant');
        }
      } else {
        setUserSession(null);
        setRole(null);
        localStorage.removeItem('acfc_user_role');
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [globalRecipes, setGlobalRecipes] = useState([]);

  const loadLowStockAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('id, name, stock_actual, stock_minimo, unit, stock_reservado');
      if (!error && data) {
        const alerts = data.filter(i => {
          const stock = Number(i.stock_actual) || 0;
          const min = Number(i.stock_minimo) || 0;
          const reserved = Number(i.stock_reservado) || 0;
          return (stock - reserved) <= min;
        });
        setLowStockAlerts(alerts);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (notificationsOpen) {
      loadLowStockAlerts();
    }
  }, [notificationsOpen, loadLowStockAlerts]);

  // Load recipes globally on startup
  const loadGlobalRecipes = useCallback(async () => {
    try {
      const { data, error } = await fetchRecipesWithIngredients();
      if (!error && data) {
        setGlobalRecipes(data);
        window.ALL_RECIPES = data;
        window.RECIPES = data;
      } else {
        const { data: flatData } = await fetchRecipes();
        const recs = flatData || [];
        setGlobalRecipes(recs);
        window.ALL_RECIPES = recs;
        window.RECIPES = recs;
      }
    } catch (e) {
      console.error('Error loading global recipes:', e);
    }
  }, []);

  useEffect(() => {
    loadGlobalRecipes();
  }, [loadGlobalRecipes]);

  // Interoperabilidad con código legacy del index.html
  useEffect(() => {
    window.showScreen = (id) => {
      if (id === 'recetas') {
        setActiveTab('recipes');
      } else if (id === 'proveedores') {
        setActiveTab('suppliers');
      } else if (id === 'inventory') {
        setActiveTab('inventory');
      } else if (id === 'planner') {
        setActiveTab('planner');
      } else if (id === 'recipes') {
        setActiveTab('recipes');
      } else {
        setActiveTab(id);
      }
      setMobileMenuOpen(false);
    };

    window.openNewModal = () => setNewModalOpen(true);
    window.closeNewModal = () => setNewModalOpen(false);
    window.openNotificationsModal = () => setNotificationsOpen(true);
    window.openMenuSettingsModal = () => setSettingsOpen(true);
    window.openProfileCjModal = () => setProfileOpen(true);

    return () => {
      window.openNewModal = null;
      window.closeNewModal = null;
      window.openNotificationsModal = null;
      window.openMenuSettingsModal = null;
      window.openProfileCjModal = null;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (activeTab === 'dashboard' || activeTab === 'inventory' || activeTab === 'recipes' || activeTab === 'suppliers' || activeTab === 'planner') return;
    setLoading(true);
    try {
      const res = await fetchData(activeTab, month);
      if (res && res.success) {
        setData(res.items || []);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allTabs = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { id: 'inventory', icon: <Package size={18} />,         label: 'Inventario' },
    { id: 'recipes',   icon: <Utensils size={18} />,        label: 'Recetas' },
    { id: 'suppliers', icon: <Truck size={18} />,           label: 'Proveedores' },
    { id: 'planner',   icon: <Utensils size={18} />,        label: 'Planificador' },
    { id: 'compras',   icon: <ShoppingCart size={18} />,     label: 'Compras' },
  ];

  const tabs = allTabs.filter(t => role !== 'assistant' || t.id !== 'suppliers');

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    } finally {
      localStorage.removeItem('acfc_user_role');
      setUserSession(null);
      setRole(null);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Verificando sesión segura con Supabase Auth...</span>
        </div>
      </div>
    );
  }

  if (!userSession) {
    return (
      <LoginScreen 
        onLoginSuccess={(user, userRole) => { 
          setUserSession(user); 
          setRole(userRole); 
        }} 
      />
    );
  }

  return (
    <>
      {showIntro && (
        <SplashScreen
          onFinished={() => {
            sessionStorage.setItem('introPlayed', 'true');
            setShowIntro(false);
          }}
        />
      )}
      <div className="app-container">
        {/* NAVBAR */}
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200" style={{ boxShadow: '0 1px 8px rgba(15,23,42,.06)' }}>
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between gap-4">
            
            {/* Left: Logo + hamburger */}
            <div className="flex items-center gap-3">
              <button 
                id="hamburger-btn" 
                onClick={() => setMobileMenuOpen(o => !o)} 
                className="md:hidden flex items-center justify-center p-2 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors" 
                aria-label="Abrir menú"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>menu</span>
              </button>
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                <div className="w-9 h-9 rounded-xl bg-brand-muted flex items-center justify-center overflow-hidden">
                  <img 
                    src="logo.png" 
                    alt="ACFC Logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.outerHTML = '<span class="material-symbols-outlined" style="color:#4f46e5;font-size:22px">restaurant</span>'; }}
                  />
                </div>
                <span className="font-display font-bold text-slate-900 text-[17px] tracking-tight" style={{ fontFamily: 'Outfit' }}>ACFC Kitchen</span>
                <span className="hidden sm:inline-block badge badge-indigo ml-1">Pro</span>
              </div>
            </div>

            {/* Center: Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map(tab => (
                <a 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)} 
                  className={`nav-link cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id ? 'active bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {tab.icon}
                  {tab.label}
                </a>
              ))}
            </nav>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              {role !== 'assistant' && (
                <button onClick={() => setNewModalOpen(true)} className="flex items-center gap-1.5 bg-brand text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-brand-dark transition-colors shadow-sm" style={{ fontFamily: 'Inter' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                  <span className="hidden sm:inline">Nuevo</span>
                </button>
              )}
              <button onClick={() => setNotificationsOpen(true)} className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" aria-label="Notificaciones">
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>notifications</span>
                {lowStockAlerts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full pulse-red"></span>}
              </button>
              <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors hidden sm:flex" aria-label="Ajustes">
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>settings</span>
              </button>
              <div 
                onClick={() => setProfileOpen(true)} 
                className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-white font-bold text-sm cursor-pointer" 
                title={userSession?.email || 'Usuario'}
              >
                {(userSession?.email || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Mobile nav */}
          {mobileMenuOpen && (
            <div id="mobile-nav" className="md:hidden border-t border-slate-100 bg-white pb-3">
              <div className="px-4 pt-2 space-y-1">
                {tabs.map(tab => (
                  <a 
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }} 
                    className={`nav-link w-full cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'active bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {tab.icon}
                    {tab.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* MAIN CONTENT */}
        <main className="content">
          {activeTab === 'dashboard' && <DashboardTab onNavigate={tab => setActiveTab(tab)} recipes={globalRecipes} role={role} setRole={setRole} />}
          {activeTab === 'inventory' && <InventoryTab role={role} canEdit={role === 'admin' || role === 'chef'} />}
          {activeTab === 'recipes' && <RecipesTab recipes={globalRecipes} reloadRecipes={loadGlobalRecipes} role={role} canEdit={role === 'admin' || role === 'chef'} />}
          {activeTab === 'suppliers' && <SuppliersTab role={role} canEdit={role === 'admin' || role === 'chef'} />}
          {activeTab === 'planner' && <PlannerTab recipes={globalRecipes} role={role} canEdit={role === 'admin' || role === 'chef'} />}
          {activeTab === 'menus' && <MenusTab data={data} loading={loading} role={role} canEdit={role === 'admin' || role === 'chef'} />}
          {activeTab === 'compras' && <ComprasTab data={data} loading={loading} month={month} onMonthChange={setMonth} onRefresh={loadData} role={role} canEdit={role === 'admin' || role === 'chef'} />}
          {activeTab === 'insumos' && <InsumosTab loading={loading} role={role} canEdit={role === 'admin' || role === 'chef'} />}
        </main>

        {/* Mobile Footer Tab Bar */}
        <nav className="tabs-nav md:hidden">
          {tabs.map(({ id, icon, label }) => (
            <button
              key={id}
              className={`tab-btn ${activeTab === id ? 'active' : ''}`}
              onClick={() => { setActiveTab(id); setData([]); }}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* MODALES EXTRAÍDOS */}
        <NewItemModal 
          isOpen={newModalOpen} 
          onClose={() => setNewModalOpen(false)} 
          onNavigate={tab => setActiveTab(tab)} 
        />
        <NotificationsPanel
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          userId={userSession?.id}
          role={role}
          lowStockAlerts={lowStockAlerts}
          onNavigate={tab => setActiveTab(tab)}
        />
        <SettingsModal 
          isOpen={settingsOpen} 
          onClose={() => setSettingsOpen(false)} 
          role={role} 
          setRole={setRole} 
        />
        <ProfileModal 
          isOpen={profileOpen} 
          onClose={() => setProfileOpen(false)} 
          userSession={userSession}
          role={role} 
          onLogout={handleLogout}
        />

        {/* BARRA DE PRUEBAS Y SIMULACIÓN (TESTING TOOLBAR) */}
        <TestingToolbar onRefresh={() => { loadGlobalRecipes(); loadData(); }} />
      </div>
    </>
  );
}

export default App;
