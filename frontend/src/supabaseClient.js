import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Variables de entorno de Supabase no configuradas. Revisa .env');
}

// In-memory fallback if localStorage throws or is unavailable (e.g. in private windows / PWAs)
const memoryStorage = new Map();

const safeAsyncStorage = {
  getItem: async (key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key) || memoryStorage.get(key) || null;
      }
    } catch (e) {
      console.warn('[SafeStorage] Error reading key:', key, e);
    }
    return memoryStorage.get(key) || null;
  },
  setItem: async (key, value) => {
    try {
      memoryStorage.set(key, value);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('[SafeStorage] Error writing key:', key, e);
    }
  },
  removeItem: async (key) => {
    try {
      memoryStorage.delete(key);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('[SafeStorage] Error removing key:', key, e);
    }
  }
};

export const supabase = createClient(
  supabaseUrl || 'https://aosweyggyalowhogjatz.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc3dleWdneWFsb3dob2dqYXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NjQzOTUsImV4cCI6MjA5ODQ0MDM5NX0.od5Zg10H_EflslfXYksolRAu81nFi2zd0vZRXDeqrcs',
  {
    auth: {
      storage: safeAsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
