import React, { useState } from 'react';
import { Utensils, Lock, Mail, ShieldAlert, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function LoginScreen({ onLoginSuccess }) {
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      let rawEmail = emailInput.trim();
      
      // Mapeo transparente para la cuenta de Asistente de Cocina
      if (rawEmail.toLowerCase() === 'kitchenassistant' || rawEmail.toLowerCase() === 'asistente') {
        rawEmail = 'kitchenassistant@acfcacademy.com';
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: rawEmail,
        password: password
      });

      if (error) throw error;

      if (data?.session) {
        // Consultar el rol del usuario autenticado en public.user_roles
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.session.user.id)
          .maybeSingle();

        const userRole = roleRow?.role || 'chef';
        localStorage.setItem('acfc_user_role', userRole);

        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(data.session.user, userRole);
        }
      }
    } catch (err) {
      console.error('Error de inicio de sesión:', err);
      setErrorMsg(err.message || 'Credenciales no válidas. Revisa tu usuario y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const executeLoginWithCredentials = async (email, pass) => {
    setErrorMsg('');
    setLoading(true);
    setEmailInput(email);
    setPassword(pass);

    try {
      let rawEmail = email.trim();
      if (rawEmail.toLowerCase() === 'kitchenassistant' || rawEmail.toLowerCase() === 'asistente') {
        rawEmail = 'jordicandelareal+assistant@gmail.com';
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: rawEmail,
        password: pass
      });

      if (error) throw error;

      if (data?.session) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.session.user.id)
          .maybeSingle();

        const userRole = roleRow?.role || 'chef';
        localStorage.setItem('acfc_user_role', userRole);

        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(data.session.user, userRole);
        }
      }
    } catch (err) {
      console.error('Error de inicio de sesión:', err);
      setErrorMsg(err.message || 'Credenciales no válidas. Revisa tu usuario y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Utensils size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>ACFC Kitchen</h1>
          <p className="text-xs text-slate-500 mt-1">Acceso seguro al sistema de gestión gastronómica</p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2.5">
            <ShieldAlert size={18} className="flex-shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Usuario / Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-slate-400" size={18} />
              <input
                type="text"
                required
                placeholder="ej: jordicandelareal+admin@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 text-slate-400" size={18} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand text-white font-bold text-sm rounded-xl hover:bg-brand-dark transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Verificando credenciales...</span>
            ) : (
              <>
                <CheckCircle size={18} />
                <span>Iniciar Sesión</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Accesos Rápidos de Prueba (1-Clic)</p>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <button
              onClick={() => executeLoginWithCredentials('jordicandelareal+admin@gmail.com', 'Smartcoach1')}
              disabled={loading}
              className="p-2 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded-lg text-slate-700 font-semibold transition-all cursor-pointer hover:border-brand"
            >
              👑 Admin
            </button>
            <button
              onClick={() => executeLoginWithCredentials('jordicandelareal+chef@gmail.com', 'Akiko')}
              disabled={loading}
              className="p-2 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded-lg text-slate-700 font-semibold transition-all cursor-pointer hover:border-brand"
            >
              👨‍🍳 Chef
            </button>
            <button
              onClick={() => executeLoginWithCredentials('jordicandelareal+assistant@gmail.com', 'AcfcKitchen')}
              disabled={loading}
              className="p-2 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded-lg text-slate-700 font-semibold transition-all cursor-pointer hover:border-brand"
            >
              🥗 Asistente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
