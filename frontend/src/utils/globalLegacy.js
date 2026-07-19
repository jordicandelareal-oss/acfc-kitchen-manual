import { supabase } from '../supabaseClient';
import * as api from '../api';
import * as mathUtils from './mathUtils';

// Fallback globals initialization for UI compatibility
if (typeof window !== 'undefined') {
  window.INVENTORY = window.INVENTORY || [];
  window.RECIPES = window.RECIPES || [];
  window.ALL_RECIPES = window.ALL_RECIPES || [];
  window.RECIPE_CATEGORIES = window.RECIPE_CATEGORIES || [];
  window.PLANNER_DATA = window.PLANNER_DATA || [];
  window.PLANNER_LOADING = false;
  window.SUPPLIERS = window.SUPPLIERS || [];
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

// Inyección global de utilidades básicas
if (typeof window !== 'undefined') {
  window.loadSupabaseRecipes = loadSupabaseRecipes;
  window.mathUtils = mathUtils;
}
