import { supabase } from '../supabaseClient';
import * as api from '../api';
import * as mathUtils from './mathUtils';

// Fallback globals initialization for UI compatibility
if (typeof window !== 'undefined') {
  window.INVENTORY = window.INVENTORY || [];
  window.RECIPES = window.RECIPES || [];
  window.ALL_RECIPES = window.ALL_RECIPES || [];
  window.RECIPE_CATEGORIES = window.RECIPE_CATEGORIES || [];
  window.PLANNER_DATA = window.PLANNER_DATA || {};
  window.PLANNER_LOADING = false;
  window.SUPPLIERS = window.SUPPLIERS || [];
  window.activeMobileDay = new Date().getDate();
}

// ── AUDITORÍA Y CARGA DE RECETAS EN REACT ────────────────────────────────────
export async function loadSupabaseRecipes() {
  try {
    const { data: cats } = await api.fetchRecipeCategories();
    window.RECIPE_CATEGORIES = cats || [];
  } catch (e) {
    console.warn('Error loading recipe categories:', e);
  }

  let recs = [];
  try {
    const { data, error } = await api.fetchRecipesWithIngredients();
    if (!error && data) {
      recs = data;
    } else {
      const { data: flatData } = await api.fetchRecipes();
      recs = flatData || [];
    }
  } catch (e) {
    console.error('Error fetching recipes:', e);
  }

  window.ALL_RECIPES = recs.map(r => {
    r.computed_cost = mathUtils.calcularCostePlato(r.recipe_ingredients);
    return r;
  });
  window.RECIPES = window.ALL_RECIPES;
  return window.ALL_RECIPES;
}

// ── CARGA Y TRANSFORMACIÓN DE DATOS DEL PLANIFICADOR ─────────────────────────
export async function fetchPlannerData() {
  window.PLANNER_LOADING = true;
  if (typeof window.renderCalendar === 'function') window.renderCalendar();

  try {
    const { data, error } = await api.fetchPlannerDataDb();
    if (error) throw error;

    // Transform array of database rows into day-indexed object (PLANNER_DATA[day])
    const plannerMap = {};
    if (data) {
      data.forEach(row => {
        if (row.date) {
          const day = new Date(row.date).getDate();
          plannerMap[day] = row;
        }
      });
    }
    window.PLANNER_DATA = plannerMap;
    console.log('PlannerTab: Estado actual de datos:', window.PLANNER_DATA);
  } catch (err) {
    console.error('Error loading planner data:', err);
  } finally {
    window.PLANNER_LOADING = false;
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
  }
}

// ── DIBUJADO DEL CALENDARIO (MIGRADO DE INDEX.HTML) ─────────────────────────
export function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return; // Guard if element is not rendered yet

  const daysInMonth = 31; // Julio
  const today = new Date().getDate();
  const recipes = window.ALL_RECIPES || [];

  const getName = (id, fallback) => {
    if (!id) return fallback;
    const r = recipes.find(rec => rec.id === id);
    return r ? r.name : fallback;
  };

  let html = '';
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today;
    const menu = window.PLANNER_DATA[d] || null;

    const breakfastName = getName(menu?.breakfast_recipe_id, 'Café / Zumo');
    const lunchName = getName(menu?.lunch_recipe_id, 'Sin asignar');
    const lunchSideName = getName(menu?.lunch_side_recipe_id, '');
    const dinnerName = getName(menu?.dinner_recipe_id, 'Sin asignar');

    const hasMeal = menu && (menu.lunch_recipe_id || menu.dinner_recipe_id);

    html += `
      <div class="card p-3 min-h-[140px] flex flex-col justify-between transition-all ${
        isToday 
          ? 'ring-2 ring-brand ring-offset-2 bg-brand-muted/20 border-brand' 
          : hasMeal 
            ? 'bg-indigo-50/40 border-indigo-200 shadow-sm' 
            : 'bg-white hover:border-slate-300'
      }">
        <div class="flex justify-between items-start">
          <span class="text-xs font-bold font-display ${isToday ? 'text-brand' : 'text-slate-500'}">${d}</span>
          ${isToday ? '<span class="w-1.5 h-1.5 rounded-full bg-brand"></span>' : ''}
        </div>

        <div class="mt-2 space-y-1 flex-grow">
          <!-- Almuerzo -->
          <div class="text-[10px] truncate leading-normal ${menu?.lunch_recipe_id ? 'text-brand font-semibold' : 'text-slate-400 italic'}">
            🌞 ${lunchName}
          </div>
          <!-- Acompañamiento -->
          ${lunchSideName ? `
          <div class="text-[9px] truncate leading-normal text-emerald-600 font-medium pl-2">
            🥗 ${lunchSideName}
          </div>` : ''}
          <!-- Cena -->
          <div class="text-[10px] truncate leading-normal ${menu?.dinner_recipe_id ? 'text-indigo-600 font-semibold' : 'text-slate-400 italic'}">
            🌙 ${dinnerName}
          </div>
        </div>

        <div class="mt-2 pt-2 border-t border-slate-100/50 flex justify-between items-center text-[10px] text-slate-400">
          <span>👥 ${menu?.lunch_players || 0}</span>
          <button onclick="if(window.openPlannerDayModal) window.openPlannerDayModal(${d})" class="text-brand hover:underline font-bold transition-all">Editar</button>
        </div>
      </div>
    `;
  }
  grid.innerHTML = html;
}

// Inyección global de utilidades
if (typeof window !== 'undefined') {
  window.loadSupabaseRecipes = loadSupabaseRecipes;
  window.fetchPlannerData = fetchPlannerData;
  window.renderCalendar = renderCalendar;
  window.mathUtils = mathUtils;

  // Recipe API bindings on window
  window.updateRecipe = api.updateRecipe;
  window.insertRecipe = api.insertRecipe;
  window.deleteRecipe = api.deleteRecipe;
  window.deleteRecipeIngredients = api.deleteRecipeIngredients;
  window.insertRecipeIngredients = api.insertRecipeIngredients;
  window.updateRecipeCategory = api.updateRecipeCategory;
  window.deleteRecipeCategory = api.deleteRecipeCategory;
  window.insertRecipeCategory = api.insertRecipeCategory;

  // Modern Toast notification system
  window.toast = window.toast || function(message) {
    console.log('Toast message:', message);
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.position = 'fixed';
      container.style.top = '20px';
      container.style.right = '20px';
      container.style.zIndex = '99999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '8px';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.style.background = '#1e293b';
    el.style.color = '#ffffff';
    el.style.padding = '10px 18px';
    el.style.borderRadius = '10px';
    el.style.fontSize = '13px';
    el.style.fontWeight = '500';
    el.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '8px';
    el.style.border = '1px solid #334155';
    el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    el.textContent = message;

    container.appendChild(el);
    
    // Trigger transition
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 10);

    // Auto-remove
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(() => el.remove(), 200);
    }, 3500);
  };
}

