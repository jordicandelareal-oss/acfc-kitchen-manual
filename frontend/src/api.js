import { supabase } from './supabaseClient';

// ── Auth & Roles ──
export const fetchUserRoleDb = async (userId) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return data?.role || null;
};

// ── Menús: planning semanal ────────────────────────────────────────────────
export const fetchMenus = async () => {
  try {
    const { data, error } = await supabase
      .from('menu_planning')
      .select(`
        id,
        planning_date,
        meal_type,
        servings,
        recipe_id,
        recipes (
          id,
          name
        )
      `)
      .order('planning_date', { ascending: true })
      .limit(30);
    if (error) throw error;

    // Group the planning by date to fit the MenusTab expectation of date-grouped rows
    const grouped = {};
    (data || []).forEach(row => {
      const dateStr = row.planning_date;
      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          date: dateStr,
          lunch_recipe: null,
          dinner_recipe: null,
          side_dish: null,
          breakfast_recipe: null
        };
      }
      if (row.meal_type === 'lunch') {
        grouped[dateStr].lunch_recipe = row.recipes?.name || null;
      } else if (row.meal_type === 'dinner') {
        grouped[dateStr].dinner_recipe = row.recipes?.name || null;
      } else if (row.meal_type === 'side' || row.meal_type === 'lunch_side') {
        grouped[dateStr].side_dish = row.recipes?.name || null;
      } else if (row.meal_type === 'breakfast') {
        grouped[dateStr].breakfast_recipe = row.recipes?.name || null;
      }
    });

    return { success: true, items: Object.values(grouped) };
  } catch (err) {
    console.error('fetchMenus:', err);
    return { success: false, items: [], error: err.message };
  }
};

// ── Compras: lista de ingredientes con stock ───────────────────────────────
export const fetchShoppingList = async () => {
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, unit, stock_actual, stock_reservado, stock_minimo, stock_maximo, purchase_price, purchase_format_gr, waste_percentage, calculated_net_cost_kg, precio_por_kg, precio_por_u, supplier_id, output_scenario, suppliers(id, name, phone, email)')
      .order('name', { ascending: true });
    if (error) throw error;
    return { success: true, items: data || [] };
  } catch (err) {
    console.error('fetchShoppingList:', err);
    return { success: false, items: [], error: err.message };
  }
};

// ── Insumos: catálogo completo con precios por proveedor ───────────────────
export const fetchInsumos = async (filters = {}) => {
  try {
    let query = supabase
      .from('ingredients')
      .select(`
        id,
        name,
        category,
        subcategory,
        nutritional_category,
        unit,
        precio_por_kg,
        precio_por_u,
        precio_por_gramo,
        precio_mas_bajo,
        proveedor_principal,
        precios_por_proveedor,
        current_stock,
        min_stock,
        stock_actual,
        stock_minimo,
        stock_maximo,
        stock_reservado,
        supplier_id,
        updated_at,
        image_url,
        brand,
        provider_ref,
        purchase_format_gr,
        purchase_price,
        output_scenario,
        waste_percentage,
        process_type,
        calculated_net_cost_kg
      `)
      .order('category', { ascending: true })
      .order('name',     { ascending: true });

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.search)   query = query.ilike('name', `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, items: data || [] };
  } catch (err) {
    console.error('fetchInsumos:', err);
    return { success: false, items: [], error: err.message };
  }
};

// ── Actualizar precio de un ingrediente ────────────────────────────────────
export const updateIngredientPrice = async (id, fields) => {
  try {
    const patch = { updated_at: new Date().toISOString() };
    if (fields.precio_por_kg    != null && parseFloat(fields.precio_por_kg) > 0) patch.precio_por_kg    = parseFloat(fields.precio_por_kg);
    if (fields.precio_por_u     != null && parseFloat(fields.precio_por_u) > 0) patch.precio_por_u     = parseFloat(fields.precio_por_u);
    if (fields.precio_mas_bajo  != null && parseFloat(fields.precio_mas_bajo) > 0) patch.precio_mas_bajo  = parseFloat(fields.precio_mas_bajo);
    if (fields.proveedor_principal != null) patch.proveedor_principal = fields.proveedor_principal;
    if (fields.stock_actual     != null) patch.stock_actual     = parseFloat(fields.stock_actual);
    if (fields.stock_minimo     != null) patch.stock_minimo     = parseFloat(fields.stock_minimo);
    if (fields.stock_maximo     != null) patch.stock_maximo     = parseFloat(fields.stock_maximo);
    if (fields.stock            != null) patch.stock_actual     = parseFloat(fields.stock);

    const { error } = await supabase.from('ingredients').update(patch).eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('updateIngredientPrice:', err);
    return { success: false, error: err.message };
  }
};

// ── Estadísticas del dashboard ─────────────────────────────────────────────
export const fetchDashboardStats = async () => {
  try {
    const [totalRes, ordersRes] = await Promise.all([
      supabase.from('ingredients').select('id', { count: 'exact', head: true }),
      supabase.from('purchase_orders').select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);
    return {
      success: true,
      totalIngredients: totalRes.count  || 0,
      lowStockAlerts:   0,
      pendingOrders:    ordersRes.count || 0,
    };
  } catch (err) {
    console.error('fetchDashboardStats:', err);
    return { success: false, totalIngredients: 0, lowStockAlerts: 0, pendingOrders: 0 };
  }
};

// ── Compat: firma genérica usada por App.jsx ───────────────────────────────
export const fetchData = async (action, month = '') => {
  if (action === 'menus')   return fetchMenus();
  if (action === 'compras') return fetchShoppingList();
  if (action === 'insumos') return fetchInsumos();
  return fetchShoppingList();
};

export const saveData = async (entity, id, fields) => {
  if (entity === 'insumos') return updateIngredientPrice(id, fields);
  return { success: false, error: 'Operación no soportada' };
};

// ── CENTRALIZED SUPABASE DATABASE WRAPPERS ──

// ── Suppliers ──
export const fetchSuppliers = async () => {
  return supabase.from('suppliers').select('*').order('name', { ascending: true });
};

export const insertSupplier = async (payload) => {
  return supabase.from('suppliers').insert(payload);
};

export const updateSupplier = async (id, payload) => {
  return supabase.from('suppliers').update(payload).eq('id', id);
};

export const deleteSupplier = async (id) => {
  return supabase.from('suppliers').delete().eq('id', id);
};

// ── Comensales ──
export const fetchComensales = async () => {
  return supabase.from('comensales').select('*').order('nombre');
};

export const insertComensal = async (payload) => {
  return supabase.from('comensales').insert([payload]).select().single();
};

export const updateComensal = async (id, payload) => {
  return supabase.from('comensales').update(payload).eq('id', id);
};

export const deleteComensal = async (id) => {
  return supabase.from('comensales').delete().eq('id', id);
};

// ── Ingredients ──
export const fetchIngredients = async () => {
  return supabase.from('ingredients').select('*').order('name');
};

export const insertIngredient = async (payload) => {
  return supabase.from('ingredients').insert([payload]).select().single();
};

export const updateIngredient = async (id, payload) => {
  return supabase.from('ingredients').update(payload).eq('id', id);
};

export const deleteIngredient = async (id) => {
  return supabase.from('ingredients').delete().eq('id', id);
};

export const updateCategoryName = async (oldName, newName) => {
  return supabase.from('ingredients').update({ category: newName }).eq('category', oldName);
};

export const nullifyCategory = async (catName) => {
  return supabase.from('ingredients').update({ category: null }).eq('category', catName);
};

export const updateSubcategory = async (cat, sub, newSubVal) => {
  return supabase.from('ingredients').update({ subcategory: newSubVal }).eq('category', cat).eq('subcategory', sub);
};

export const deleteSubcategory = async (cat, sub) => {
  return supabase.from('ingredients').update({ subcategory: '' }).eq('category', cat).eq('subcategory', sub);
};

// ── Recipe Categories ──
export const fetchRecipeCategories = async () => {
  return supabase.from('recipe_categories').select('*').order('name');
};

export const insertRecipeCategory = async (name) => {
  return supabase.from('recipe_categories').insert({ name });
};

export const updateRecipeCategory = async (id, name) => {
  return supabase.from('recipe_categories').update({ name }).eq('id', id);
};

export const deleteRecipeCategory = async (id) => {
  return supabase.from('recipe_categories').delete().eq('id', id);
};

// ── Recipes ──
export const fetchRecipes = async () => {
  return supabase.from('recipes').select('*').order('name');
};

export const fetchRecipesWithIngredients = async () => {
  return supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients (
        quantity_per_portion,
        unit,
        tipo_corte,
        ingredients (
          id,
          name,
          calculated_net_cost_kg,
          nutritional_category,
          precio_por_kg,
          precio_por_u,
          precio_mas_bajo,
          waste_percentage,
          supplier_id,
          suppliers (
            id,
            name,
            phone,
            email,
            contact_name
          )
        )
      )
    `)
    .order('name');
};

export const insertRecipe = async (payload) => {
  return supabase.from('recipes').insert(payload).select('id').single();
};

export const updateRecipe = async (id, payload) => {
  return supabase.from('recipes').update(payload).eq('id', id);
};

export const deleteRecipe = async (id) => {
  return supabase.from('recipes').delete().eq('id', id);
};

// ── Recipe Ingredients ──
export const deleteRecipeIngredients = async (recipeId) => {
  return supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
};

export const insertRecipeIngredients = async (ingredientsArray) => {
  return supabase.from('recipe_ingredients').insert(ingredientsArray);
};

// ── Planner ──
export const fetchPlannerDataDb = async (startDate, endDate) => {
  let query = supabase.from('menu_planner').select(`
    *,
    breakfast_recipe:recipes!breakfast_recipe_id(id, name, image_url),
    lunch_recipe:recipes!lunch_recipe_id(id, name, image_url),
    lunch_side_recipe:recipes!lunch_side_recipe_id(id, name, image_url),
    dinner_recipe:recipes!dinner_recipe_id(id, name, image_url)
  `);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  return query;
};

export const fetchPlannerFullWithIngredients = async (startDate, endDate) => {
  let query = supabase.from('menu_planner').select(`
    *,
    breakfast_recipe:recipes!breakfast_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
    lunch_recipe:recipes!lunch_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
    lunch_side_recipe:recipes!lunch_side_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*)))),
    dinner_recipe:recipes!dinner_recipe_id(*, recipe_ingredients(*, ingredients(*, suppliers(*))))
  `);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  return query.order('date', { ascending: true });
};

export const fetchMenuWeeks = async () => {
  return supabase.from('menu_weeks').select('*').order('start_date', { ascending: true });
};

// ── Helper: race a promise against a timeout so menu_weeks never hangs ────────
const withTimeout = (promise, ms = 5000, label = 'operation') =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[menu_weeks] Timeout after ${ms}ms (${label})`)), ms)
    )
  ]);

// ── Helper to resolve or register week in menu_weeks using Madrid timezone ──
export const obtenerORegistrarSemana = async (dateStr) => {
  if (!dateStr) return null;
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    // Find weekday index in Europe/Madrid timezone (Mon=0, ..., Sun=6)
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Madrid',
      weekday: 'short'
    });
    const weekdayStr = dtf.format(dateObj);
    const mapping = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
    const weekdayIndex = mapping[weekdayStr] ?? 0;

    const monday = new Date(dateObj);
    monday.setDate(dateObj.getDate() - weekdayIndex);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const dtfISO = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const start_date = dtfISO.format(monday);
    const end_date   = dtfISO.format(sunday);
    const monParts   = start_date.split('-').map(Number);

    // Try to find existing week (with 5s timeout)
    const { data: existingWeek, error: selectErr } = await withTimeout(
      supabase.from('menu_weeks').select('*')
        .eq('start_date', start_date)
        .eq('end_date', end_date)
        .maybeSingle(),
      5000, 'select week'
    );
    if (selectErr) console.warn('[menu_weeks] Error fetching week:', selectErr);
    if (existingWeek) return existingWeek;

    // Upsert to prevent race condition 400 error (with 5s timeout)
    const { data: newWeek, error: upsertErr } = await withTimeout(
      supabase.from('menu_weeks')
        .upsert(
          [{ start_date, end_date, year: monParts[0], month: monParts[1] }],
          { onConflict: 'start_date,end_date' }
        )
        .select()
        .maybeSingle(),
      5000, 'upsert week'
    );

    if (upsertErr) {
      console.warn('[menu_weeks] Upsert error (non-blocking):', upsertErr);
      // Retry fetch one last time
      const { data: retryWeek } = await supabase.from('menu_weeks').select('*')
        .eq('start_date', start_date).eq('end_date', end_date).maybeSingle();
      return retryWeek ?? null;
    }

    return newWeek ?? null;
  } catch (err) {
    // Timeout or unexpected error — log and return null so callers can continue
    console.warn('[menu_weeks] obtenerORegistrarSemana failed (non-blocking):', err.message);
    return null;
  }
};

export const upsertPlannerDays = async (upsertsArray) => {
  return supabase.from('menu_planner').upsert(upsertsArray, { onConflict: 'date' });
};

export const updatePlannerDay = async (id, payload) => {
  return supabase.from('menu_planner').update(payload).eq('id', id);
};

export const resetPlannerDates = async (allDates, fields) => {
  return supabase.from('menu_planner').update(fields).in('date', allDates);
};

// ── Storage / Images ──
export const uploadRecipeImageFile = async (filePath, file, options = {}) => {
  return supabase.storage.from('recipe-images').upload(filePath, file, options);
};

export const getRecipePublicUrl = async (filePath) => {
  return supabase.storage.from('recipe-images').getPublicUrl(filePath);
};

export const confirmarYDescontarStock = async (planId) => {
  return supabase.rpc('confirmar_y_descontar_stock', { plan_id: planId });
};

// ── Guardar menú borrador (Sin alterar stock_reservado) ──
export const guardarMenuBorrador = async (menuDays) => {
  try {
    const upserts = [];
    for (const item of menuDays) {
      const week = await obtenerORegistrarSemana(item.date);
      
      // Protection: if the week is confirmed = true, respect it and do not overwrite
      if (week && week.confirmado) {
        console.warn(`[API] La semana para ${item.date} está confirmada. Omitiendo sobrescritura automática.`);
        continue;
      }

      upserts.push({
        date: item.date,
        week_id: week?.id || null,
        breakfast_recipe_id: item.breakfast_recipe_id || null,
        lunch_recipe_id: item.lunch_recipe_id || null,
        lunch_side_recipe_id: item.lunch_side_recipe_id || null,
        dinner_recipe_id: item.dinner_recipe_id || null,
        breakfast_players: Number(item.breakfast_players) || 20,
        breakfast_halal: 0,
        breakfast_kosher: 0,
        breakfast_vegan: 0,
        breakfast_allergies: item.breakfast_allergies || '',
        lunch_players: Number(item.lunch_players) || 25,
        dinner_players: Number(item.dinner_players) || 20,
        lunch_halal: 0,
        lunch_kosher: 0,
        lunch_vegan: 0,
        lunch_allergies: item.lunch_allergies || '',
        dinner_halal: 0,
        dinner_kosher: 0,
        dinner_vegan: 0,
        dinner_allergies: item.dinner_allergies || '',
        confirmado: false,
        updated_at: new Date().toISOString()
      });
    }

    if (upserts.length === 0) {
      return { data: { success: true, message: 'Ningún día guardado (todas las semanas están confirmadas).' }, error: null };
    }

    const { data, error } = await supabase
      .from('menu_planner')
      .upsert(upserts, { onConflict: 'date' });
    
    return { data, error };
  } catch (err) {
    return { error: err };
  }
};

export const guardarMenuYReservarStock = async (menuDays) => {
  return guardarMenuBorrador(menuDays);
};

// --- DUAL TRACK AUDIT & HELPER ---
const runDualTrackAudit = async (menuDays) => {
  try {
    console.log('--- 🚀 INICIANDO AUDITORÍA DE DOBLE CARRIL (OPCIÓN B) ---');
    
    // 1. Fetch active vegetarians
    const { data: comensales } = await supabase.from('comensales').select('dieta').eq('activo', true);
    let vegCount = 0;
    if (comensales) {
      vegCount = comensales.filter(c => c.dieta && (c.dieta.toLowerCase().includes('vegetarian') || c.dieta.toLowerCase().includes('vegan') || c.dieta.toLowerCase().includes('vegano'))).length;
    }
    console.log(`a) 👥 Comensales vegetarianos detectados para el turno: ${vegCount}`);

    // Fetch all recipes to find alternatives
    const { data: recipes } = await supabase.from('recipes').select('id, name, is_vegetarian, category, equivalent_recipe_id');

    const getAlternative = (mainRecipeId) => {
      if (!mainRecipeId || !recipes) return null;
      const main = recipes.find(r => r.id === mainRecipeId);
      if (!main) return null;
      if (main.is_vegetarian || main.category === 'Vegetariano') return main;

      // Prioridad 1 (Relación Directa)
      if (main.equivalent_recipe_id) {
        const equiv = recipes.find(r => r.id === main.equivalent_recipe_id);
        if (equiv) return equiv;
      }

      // Prioridad 2 (Coincidencia de Nombre Base)
      const exactMatch = recipes.find(r => 
        (r.name.toLowerCase().startsWith(main.name.toLowerCase() + ' (vegetarian)') || 
         r.name.toLowerCase().startsWith(main.name.toLowerCase() + ' (vegetariano)')) &&
        (r.is_vegetarian || r.category === 'Vegetariano')
      );
      if (exactMatch) return exactMatch;
      
      // Prioridad 3 (Fallback Seguro)
      return recipes.find(r => r.is_vegetarian || r.category === 'Vegetariano') || main;
    };

    for (const day of menuDays) {
      console.log(`\\n📅 Analizando fecha: ${day.date}`);
      const turns = [
        { name: 'Desayuno', recipeId: day.breakfast_recipe_id, players: day.breakfast_players || 20 },
        { name: 'Almuerzo', recipeId: day.lunch_recipe_id, players: day.lunch_players || 25 },
        { name: 'Guarnición Almuerzo', recipeId: day.lunch_side_recipe_id, players: day.lunch_players || 25 },
        { name: 'Cena', recipeId: day.dinner_recipe_id, players: day.dinner_players || 20 },
      ];

      for (const turn of turns) {
        if (!turn.recipeId || turn.players <= 0) continue;
        
        const mainRecipe = recipes?.find(r => r.id === turn.recipeId);
        const stdPlayers = Math.max(0, turn.players - vegCount);
        const vegPlayers = Math.min(turn.players, vegCount);
        
        console.log(`\\n  🍽️ Turno: ${turn.name} (Total: ${turn.players} pax | Estándar: ${stdPlayers} | Veg: ${vegPlayers})`);
        console.log(`  b) Receta Principal: ${mainRecipe?.name || 'Desconocida'} (ID: ${turn.recipeId})`);
        
        if (vegPlayers > 0) {
          const altRecipe = getAlternative(turn.recipeId);
          console.log(`  c) Receta Alternativa Veg: ${altRecipe?.name || 'Ninguna'} (ID: ${altRecipe?.id})`);
          
          // Simular cálculo de ingredientes
          const { data: stdIngs } = await supabase.from('recipe_ingredients').select('quantity_per_portion, ingredients(name)').eq('recipe_id', turn.recipeId);
          const { data: altIngs } = await supabase.from('recipe_ingredients').select('quantity_per_portion, ingredients(name)').eq('recipe_id', altRecipe?.id);
          
          console.log(`  d) Ingredientes Integrados:`);
          
          const combined = {};
          if (stdPlayers > 0 && stdIngs) {
            stdIngs.forEach(ri => {
              const name = ri.ingredients?.name;
              if (!name) return;
              const qty = (Number(ri.quantity_per_portion) * stdPlayers);
              if (!combined[name]) combined[name] = { qty: 0, from: [] };
              combined[name].qty += qty;
              combined[name].from.push('Estándar');
            });
          }
          if (vegPlayers > 0 && altIngs) {
            altIngs.forEach(ri => {
              const name = ri.ingredients?.name;
              if (!name) return;
              const qty = (Number(ri.quantity_per_portion) * vegPlayers);
              if (!combined[name]) combined[name] = { qty: 0, from: [] };
              combined[name].qty += qty;
              combined[name].from.push('Veg');
            });
          }
          
          Object.keys(combined).forEach(ing => {
            const info = combined[ing];
            const isMerged = info.from.includes('Estándar') && info.from.includes('Veg');
            console.log(`     - ${ing}: ${info.qty.toFixed(2)} (Origen: ${isMerged ? 'Fusión Estándar+Veg' : info.from[0]})`);
          });
        }
      }
    }
    console.log('--- 🏁 FIN AUDITORÍA ---');
  } catch (e) {
    console.error('Error en auditoría de doble carril:', e);
  }
};

// ── Guardar y Confirmar menú (Reserva stock_reservado explícitamente) ──
export const guardarYConfirmarMenu = async (menuDays) => {
  try {
    // 0. Ejecutar auditoría en consola
    await runDualTrackAudit(menuDays);

    const upserts = [];
    const uniqueWeeksToConfirm = new Map();

    for (const item of menuDays) {
      // menu_weeks registration is non-blocking — failure must NOT stop the save
      let week = null;
      try {
        week = await obtenerORegistrarSemana(item.date);
      } catch (weekErr) {
        console.warn('[menu_weeks] Skipping week for', item.date, weekErr.message);
      }
      if (week) {
        const key = `${week.start_date}_${week.end_date}`;
        uniqueWeeksToConfirm.set(key, week);
      }

      upserts.push({
        date: item.date,
        week_id: week?.id || null,
        breakfast_recipe_id: item.breakfast_recipe_id || null,
        lunch_recipe_id: item.lunch_recipe_id || null,
        lunch_side_recipe_id: item.lunch_side_recipe_id || null,
        dinner_recipe_id: item.dinner_recipe_id || null,
        breakfast_players: Number(item.breakfast_players) || 20,
        breakfast_halal: 0,
        breakfast_kosher: 0,
        breakfast_vegan: 0,
        breakfast_allergies: item.breakfast_allergies || '',
        lunch_players: Number(item.lunch_players) || 25,
        dinner_players: Number(item.dinner_players) || 20,
        lunch_halal: 0,
        lunch_kosher: 0,
        lunch_vegan: 0,
        lunch_allergies: item.lunch_allergies || '',
        dinner_halal: 0,
        dinner_kosher: 0,
        dinner_vegan: 0,
        dinner_allergies: item.dinner_allergies || '',
        confirmado: true,
        updated_at: new Date().toISOString()
      });
    }

    // 1. Release existing reservations if previously confirmed
    for (const day of menuDays) {
      const { data: existingPlan } = await supabase
        .from('menu_planner')
        .select('*')
        .eq('date', day.date)
        .maybeSingle();

      if (existingPlan && existingPlan.confirmado) {
        const oldRecipes = [
          { recipeId: existingPlan.breakfast_recipe_id, players: existingPlan.breakfast_players || 20 },
          { recipeId: existingPlan.lunch_recipe_id, players: existingPlan.lunch_players || 25 },
          { recipeId: existingPlan.lunch_side_recipe_id, players: existingPlan.lunch_players || 25 },
          { recipeId: existingPlan.dinner_recipe_id, players: existingPlan.dinner_players || 20 }
        ];

        for (const oldItem of oldRecipes) {
          if (!oldItem.recipeId || oldItem.players <= 0) continue;
          const { data: oldRi } = await supabase
            .from('recipe_ingredients')
            .select('ingredient_id, quantity_per_portion')
            .eq('recipe_id', oldItem.recipeId);

          if (oldRi) {
            for (const ri of oldRi) {
              const qtyToRelease = Number(ri.quantity_per_portion || 0) * oldItem.players;
              if (qtyToRelease > 0 && ri.ingredient_id) {
                const { data: ingData } = await supabase
                  .from('ingredients')
                  .select('stock_reservado')
                  .eq('id', ri.ingredient_id)
                  .single();

                const currentReserved = Number(ingData?.stock_reservado || 0);
                const newReserved = Math.max(0, currentReserved - qtyToRelease);
                await supabase
                  .from('ingredients')
                  .update({ stock_reservado: newReserved, updated_at: new Date().toISOString() })
                  .eq('id', ri.ingredient_id);
              }
            }
          }
        }
      }
    }

    const { error: upsertErr } = await supabase
      .from('menu_planner')
      .upsert(upserts, { onConflict: 'date' });

    if (upsertErr) return { error: upsertErr };

    // 2. Mark weeks as confirmed via robust upsert
    for (const week of uniqueWeeksToConfirm.values()) {
      if (!week.start_date || !week.end_date) continue;
      try {
        await supabase
          .from('menu_weeks')
          .upsert([{
            start_date: week.start_date,
            end_date: week.end_date,
            year: week.year,
            month: week.month,
            confirmado: true,
            updated_at: new Date().toISOString()
          }], { onConflict: 'start_date,end_date' });
      } catch (confirmErr) {
        console.warn('[menu_weeks] Failed to confirm week:', week.start_date, confirmErr.message);
      }
    }

    // 3. Reserve stock for the new recipes
    for (const day of menuDays) {
      const recipesToReserve = [
        { recipeId: day.breakfast_recipe_id, players: day.breakfast_players || 20 },
        { recipeId: day.lunch_recipe_id, players: day.lunch_players || 25 },
        { recipeId: day.lunch_side_recipe_id, players: day.lunch_players || 25 },
        { recipeId: day.dinner_recipe_id, players: day.dinner_players || 20 }
      ];

      for (const item of recipesToReserve) {
        if (!item.recipeId || item.players <= 0) continue;
        const { data: riData } = await supabase
          .from('recipe_ingredients')
          .select('ingredient_id, quantity_per_portion')
          .eq('recipe_id', item.recipeId);

        if (riData) {
          for (const ri of riData) {
            const qtyNeeded = Number(ri.quantity_per_portion || 0) * item.players;
            if (qtyNeeded > 0 && ri.ingredient_id) {
              const { data: ingData } = await supabase
                .from('ingredients')
                .select('stock_reservado')
                .eq('id', ri.ingredient_id)
                .single();
              
              const currentReserved = Number(ingData?.stock_reservado || 0);
              await supabase
                .from('ingredients')
                .update({ stock_reservado: currentReserved + qtyNeeded, updated_at: new Date().toISOString() })
                .eq('id', ri.ingredient_id);
            }
          }
        }
      }
    }

    return { data: { success: true }, error: null };
  } catch (err) {
    return { error: err };
  }
};

// ── Eliminar Menú y Liberar Stock ──
export const eliminarMenuYLiberarStock = async (datesArray) => {
  try {
    const res = await supabase.rpc('eliminar_menu_y_liberar_stock', { p_dates: datesArray });
    if (!res?.error) return res;
  } catch (e) {
    console.warn('RPC eliminar_menu_y_liberar_stock fallo, ejecutando fallback JS:', e);
  }

  try {
    for (const dStr of datesArray) {
      const { data: planData } = await supabase
        .from('menu_planner')
        .select('*')
        .eq('date', dStr)
        .maybeSingle();

      if (planData) {
        const recipesToRelease = [
          { recipeId: planData.breakfast_recipe_id, players: planData.breakfast_players || 20 },
          { recipeId: planData.lunch_recipe_id, players: planData.lunch_players || 25 },
          { recipeId: planData.lunch_side_recipe_id, players: planData.lunch_players || 25 },
          { recipeId: planData.dinner_recipe_id, players: planData.dinner_players || 20 }
        ];

        for (const item of recipesToRelease) {
          if (!item.recipeId || item.players <= 0) continue;
          const { data: riData } = await supabase
            .from('recipe_ingredients')
            .select('ingredient_id, quantity_per_portion')
            .eq('recipe_id', item.recipeId);

          if (riData) {
            for (const ri of riData) {
              const qtyToRelease = Number(ri.quantity_per_portion || 0) * item.players;
              if (qtyToRelease > 0 && ri.ingredient_id) {
                const { data: ingData } = await supabase
                  .from('ingredients')
                  .select('stock_reservado')
                  .eq('id', ri.ingredient_id)
                  .single();

                const currentReserved = Number(ingData?.stock_reservado || 0);
                const newReserved = Math.max(0, currentReserved - qtyToRelease);

                await supabase
                  .from('ingredients')
                  .update({ stock_reservado: newReserved, updated_at: new Date().toISOString() })
                  .eq('id', ri.ingredient_id);
              }
            }
          }
        }

        await supabase.from('menu_planner').delete().eq('date', dStr);
      }
    }
    return { data: { success: true }, error: null };
  } catch (err) {
    return { error: err };
  }
};

export const generarListaComprasOptimizada = async () => {
  try {
    console.log("=== INICIO GENERACIÓN DE COMPRAS ===");
    
    // 1. Fetch active vegetarians
    const { data: comensales } = await supabase.from('comensales').select('dieta').eq('activo', true);
    let vegCount = 0;
    if (comensales) {
      vegCount = comensales.filter(c => c.dieta && (c.dieta.toLowerCase().includes('veget') || c.dieta.toLowerCase().includes('vegan'))).length;
    }
    const totalComensales = comensales ? comensales.length : 0;
    console.log(`TRAZA 1 - Comensales totales y vegetarianos: Totales=${totalComensales}, Vegetarianos=${vegCount}`);

    // 2. Fetch data needed for calculation
    const { data: recipes } = await supabase.from('recipes').select('id, name, is_vegetarian, category, equivalent_recipe_id');
    if (!recipes || recipes.length === 0) {
      console.error("TRAZA ERROR: Array de recetas vacío o no encontrado en BD.");
    }
    
    const { data: menuDays } = await supabase.from('menu_planner').select('*');
    if (!menuDays || menuDays.length === 0) {
      console.error("TRAZA ERROR: Array de menús cargados (menu_planner) llegó vacío.");
    } else {
      console.log(`TRAZA 2 - Menús cargados del planificador: ${menuDays.length} días planificados.`);
    }

    const { data: allRecipeIngredients } = await supabase.from('recipe_ingredients').select('recipe_id, ingredient_id, quantity_per_portion, unit, tipo_corte, ingredients(name, stock_actual, supplier_id, suppliers(name))');
    if (!allRecipeIngredients || allRecipeIngredients.length === 0) {
      console.error("TRAZA ERROR: No hay ingredientes mapeados en recipe_ingredients.");
    }

    if (!menuDays || !recipes || !allRecipeIngredients || menuDays.length === 0 || recipes.length === 0) {
      return { data: [], error: null };
    }

    const getAlternative = (mainRecipeId) => {
      const main = recipes.find(r => r.id === mainRecipeId);
      if (!main) return null;
      if (main.is_vegetarian || main.category === 'Vegetariano') return main;
      if (main.equivalent_recipe_id) {
        const equiv = recipes.find(r => r.id === main.equivalent_recipe_id);
        if (equiv) return equiv;
      }
      const exactMatch = recipes.find(r => 
        (r.name.toLowerCase().startsWith(main.name.toLowerCase() + ' (vegetari')) &&
        (r.is_vegetarian || r.category === 'Vegetariano')
      );
      if (exactMatch) return exactMatch;
      return recipes.find(r => r.is_vegetarian || r.category === 'Vegetariano') || main;
    };

    const tempNeeds = [];
    
    // 3. Dual track calculation
    for (const day of menuDays) {
      const turns = [
        { name: 'Desayuno', recipeId: day.breakfast_recipe_id, players: day.breakfast_players || 20 },
        { name: 'Almuerzo', recipeId: day.lunch_recipe_id, players: day.lunch_players || 25 },
        { name: 'Guarnición Almuerzo', recipeId: day.lunch_side_recipe_id, players: day.lunch_players || 25 },
        { name: 'Cena', recipeId: day.dinner_recipe_id, players: day.dinner_players || 20 },
      ];

      for (const turn of turns) {
        if (!turn.recipeId || turn.players <= 0) continue;
        
        const mainRecipe = recipes.find(r => r.id === turn.recipeId);
        if (!mainRecipe) {
          console.error(`TRAZA ERROR: No se encontró la receta (ID: ${turn.recipeId}) en memoria para ${turn.name}`);
          continue;
        }
        
        console.log(`TRAZA 3 - Receta principal detectada: "${mainRecipe.name}" (Turno: ${turn.name})`);
        
        const stdPlayers = Math.max(0, turn.players - vegCount);
        const vegPlayers = Math.min(turn.players, vegCount);

        // Estándar
        if (stdPlayers > 0) {
          const stdIngs = allRecipeIngredients.filter(ri => ri.recipe_id === turn.recipeId);
          console.log(`TRAZA 5 - Ingredientes estándar calculados: ${stdIngs.length} items para ${stdPlayers} pax.`);
          if (stdIngs.length === 0) console.error(`TRAZA ERROR: La receta estándar "${mainRecipe.name}" no tiene ingredientes asociados.`);
          
          for (const ri of stdIngs) {
             tempNeeds.push({
               ing_id: ri.ingredient_id,
               ing_name: ri.ingredients?.name || 'Desconocido',
               supp_name: ri.ingredients?.suppliers?.name || 'Sin proveedor asignado',
               corte: ri.tipo_corte || 'Entera',
               qty: (Number(ri.quantity_per_portion) || 0) * stdPlayers,
               dest: `${mainRecipe.name} (${turn.name} Estándar)`,
               stock_actual: Number(ri.ingredients?.stock_actual) || 0
             });
          }
        }
        
        // Vegetariano
        if (vegPlayers > 0) {
          const altRecipe = getAlternative(turn.recipeId);
          if (altRecipe) {
            console.log(`TRAZA 4 - Receta equivalente/vegetariana buscada: Encontrada "${altRecipe.name}"`);
            const altIngs = allRecipeIngredients.filter(ri => ri.recipe_id === altRecipe.id);
            console.log(`TRAZA 6 - Ingredientes vegetarianos calculados: ${altIngs.length} items para ${vegPlayers} pax.`);
            if (altIngs.length === 0) console.error(`TRAZA ERROR: La receta veg "${altRecipe.name}" no tiene ingredientes asociados.`);
            
            for (const ri of altIngs) {
               tempNeeds.push({
                 ing_id: ri.ingredient_id,
                 ing_name: ri.ingredients?.name || 'Desconocido',
                 supp_name: ri.ingredients?.suppliers?.name || 'Sin proveedor asignado',
                 corte: ri.tipo_corte || 'Entera',
                 qty: (Number(ri.quantity_per_portion) || 0) * vegPlayers,
                 dest: `${altRecipe.name} (${turn.name} Veg)`,
                 stock_actual: Number(ri.ingredients?.stock_actual) || 0
               });
            }
          } else {
            console.error(`TRAZA ERROR: No se encontró receta alternativa para "${mainRecipe.name}"`);
          }
        }
      }
    }

    // 4. Consolidate logic
    const grouped = {};
    for (const item of tempNeeds) {
      if (item.qty <= 0) continue;
      const key = `${item.ing_id}_${item.supp_name}_${item.corte}`;
      if (!grouped[key]) {
        grouped[key] = {
           fila_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
           nombre_ingrediente: item.ing_name,
           proveedor: item.supp_name,
           corte: item.corte,
           cantidad_necesaria: 0,
           a_comprar: 0,
           stock_actual: item.stock_actual,
           destinations: new Set()
        };
      }
      grouped[key].cantidad_necesaria += item.qty;
      grouped[key].destinations.add(item.dest);
    }

    const result = Object.values(grouped).map(g => {
      g.a_comprar = Math.max(0, g.cantidad_necesaria - g.stock_actual);
      g.destinations = Array.from(g.destinations).join(', ');
      return g;
    });

    return { data: result, error: null };
  } catch(e) {
    console.error('TRAZA ERROR CRÍTICO en generarListaComprasOptimizada JS:', e);
    return { data: [], error: e };
  }
};

export const liberarStockReservado = async (recipeId, comensales) => {
  return supabase.rpc('liberar_stock_reservado', { p_recipe_id: recipeId, p_comensales: comensales });
};

// ── Validar Recepción de Pedidos (Compras) ──
export const validarRecepcionPedido = async (itemsArray) => {
  try {
    const res = await supabase.rpc('validar_recepcion_pedido', { p_items: itemsArray });
    if (!res?.error) return res;
  } catch (e) {
    console.warn('RPC validar_recepcion_pedido fallo, ejecutando fallback JS:', e);
  }

  try {
    let updatedCount = 0;
    for (const item of itemsArray) {
      const ingId = item.ingredient_id;
      const qtyReceived = Number(item.cantidad_recibida) || 0;
      if (!ingId || qtyReceived <= 0) continue;

      const { data: ingData } = await supabase
        .from('ingredients')
        .select('stock_actual, stock_reservado')
        .eq('id', ingId)
        .single();

      if (ingData) {
        const curActual = Number(ingData.stock_actual || 0);
        const curReserved = Number(ingData.stock_reservado || 0);

        const newActual = curActual + qtyReceived;
        const newReserved = Math.max(0, curReserved - qtyReceived);

        await supabase
          .from('ingredients')
          .update({
            stock_actual: newActual,
            stock_reservado: newReserved,
            updated_at: new Date().toISOString()
          })
          .eq('id', ingId);

        updatedCount++;
      }
    }
    return { data: { success: true, updated_count: updatedCount }, error: null };
  } catch (err) {
    return { error: err };
  }
};

// ── Simular Cierre de Turno (Comida / Cena) ──
export const simularCierreTurno = async (dateStr, shift) => {
  try {
    const res = await supabase.rpc('simular_cierre_turno', { p_date: dateStr, p_shift: shift });
    if (!res?.error) return res;
  } catch (e) {
    console.warn('RPC simular_cierre_turno fallo, ejecutando fallback JS:', e);
  }

  try {
    const { data: planData, error: fetchErr } = await supabase
      .from('menu_planner')
      .select('*')
      .eq('date', dateStr)
      .maybeSingle();

    if (fetchErr || !planData) {
      return { data: { success: false, message: `No hay menú planificado para el día ${dateStr}` }, error: null };
    }

    let recipeIds = [];
    let players = 0;

    if (shift === 'lunch') {
      players = Number(planData.lunch_players) || 25;
      if (planData.lunch_recipe_id) recipeIds.push(planData.lunch_recipe_id);
      if (planData.lunch_side_recipe_id) recipeIds.push(planData.lunch_side_recipe_id);
    } else if (shift === 'dinner') {
      players = Number(planData.dinner_players) || 20;
      if (planData.dinner_recipe_id) recipeIds.push(planData.dinner_recipe_id);
    }

    if (recipeIds.length === 0 || players <= 0) {
      return { data: { success: false, message: `No hay recetas asignadas para el turno de ${shift} el día ${dateStr}` }, error: null };
    }

    let updatedCount = 0;
    for (const rId of recipeIds) {
      const { data: riData } = await supabase
        .from('recipe_ingredients')
        .select('ingredient_id, quantity_per_portion')
        .eq('recipe_id', rId);

      if (riData) {
        for (const ri of riData) {
          const qty = Number(ri.quantity_per_portion || 0) * players;
          if (qty > 0 && ri.ingredient_id) {
            const { data: ingData } = await supabase
              .from('ingredients')
              .select('stock_actual, stock_reservado')
              .eq('id', ri.ingredient_id)
              .single();

            if (ingData) {
              const curActual = Number(ingData.stock_actual || 0);
              const curReserved = Number(ingData.stock_reservado || 0);

              const newActual = curActual - qty;
              const newReserved = Math.max(0, curReserved - qty);

              await supabase
                .from('ingredients')
                .update({
                  stock_actual: newActual,
                  stock_reservado: newReserved,
                  updated_at: new Date().toISOString()
                })
                .eq('id', ri.ingredient_id);

              updatedCount++;
            }
          }
        }
      }
    }

    const patchField = shift === 'lunch' ? { lunch_processed: true } : { dinner_processed: true };
    await supabase.from('menu_planner').update({ ...patchField, updated_at: new Date().toISOString() }).eq('id', planData.id);

    return {
      data: {
        success: true,
        shift,
        date: dateStr,
        ingredients_updated: updatedCount,
        log: `Cierre de turno ${shift} procesado correctamente para el día ${dateStr}`
      },
      error: null
    };
  } catch (err) {
    return { error: err };
  }
};

// ── Resetear Entorno de Pruebas ──
export const resetearEntornoPruebas = async () => {
  try {
    const res = await supabase.rpc('resetear_entorno_pruebas');
    if (!res?.error) return res;
  } catch (e) {
    console.warn('RPC resetear_entorno_pruebas fallo, ejecutando fallback JS:', e);
  }

  try {
    const { data: allIngs } = await supabase.from('ingredients').select('id');
    if (allIngs && allIngs.length > 0) {
      for (const ing of allIngs) {
        await supabase
          .from('ingredients')
          .update({ stock_actual: 0, stock_reservado: 0, updated_at: new Date().toISOString() })
          .eq('id', ing.id);
      }
    }
    await supabase.from('menu_planner').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    return { data: { success: true, message: 'Entorno de pruebas reseteado correctamente' }, error: null };
  } catch (err) {
    return { error: err };
  }
};

export const procesarDescuentosAutomaticosTurnos = async () => {
  try {
    const res = await supabase.rpc('procesar_descuentos_automaticos_turnos');
    if (res.error) {
      console.warn('[API] RPC procesar_descuentos_automaticos_turnos devolvió error:', res.error.message || res.error);
      return { data: { processed_count: 0 }, error: null };
    }
    return res;
  } catch (err) {
    console.warn('[API] Excepción al ejecutar procesar_descuentos_automaticos_turnos:', err);
    return { data: { processed_count: 0 }, error: null };
  }
};

// ── Órdenes de Compra (Purchase Orders) ──

/**
 * smartOrderFromAlert: crea o agrupa un artículo en una orden de compra activa.
 * Caso A – No existe orden activa para ese proveedor → crea nueva orden con el artículo.
 * Caso B – Existe orden activa (pending/ordered/sent) para ese proveedor → añade el artículo
 *           (o incrementa cantidad si ya estaba incluido) y recalcula el total.
 *
 * @param {Object} ingredient  Objeto completo del ingrediente (id, name, unit, supplier_id, stock_minimo, stock_actual, ...)
 * @returns {{ data, error }}
 */
export const smartOrderFromAlert = async (ingredient) => {
  try {
    const supplierId = ingredient.supplier_id || null;
    const neededQty = Math.max(
      0,
      Number(ingredient.stock_minimo || 0) - Number(ingredient.stock_actual || 0)
    );
    const unitPrice = Number(
      ingredient.calculated_net_cost_kg ||
      ingredient.precio_por_kg ||
      ingredient.precio_por_u ||
      ingredient.purchase_price ||
      0
    );
    const totalCost = neededQty * unitPrice;

    // 1. Buscar orden activa para este proveedor
    let activeOrderQuery = supabase
      .from('purchase_orders')
      .select('id, total_cost, purchase_order_items(id, ingredient_id, quantity_ordered, unit_price)')
      .in('status', ['pending', 'ordered', 'sent']);

    if (supplierId) {
      activeOrderQuery = activeOrderQuery.eq('supplier_id', supplierId);
    } else {
      activeOrderQuery = activeOrderQuery.is('supplier_id', null);
    }

    const { data: existingOrders, error: fetchErr } = await activeOrderQuery
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchErr) throw fetchErr;

    const existingOrder = existingOrders && existingOrders.length > 0 ? existingOrders[0] : null;

    if (existingOrder) {
      // Caso B: orden activa existe → buscar si el ingrediente ya está en ella
      const existingItem = (existingOrder.purchase_order_items || []).find(
        poi => poi.ingredient_id === ingredient.id
      );

      if (existingItem) {
        // Incrementar cantidad del ítem existente
        const newQty = Number(existingItem.quantity_ordered || 0) + neededQty;
        const { error: updateItemErr } = await supabase
          .from('purchase_order_items')
          .update({ quantity_ordered: newQty })
          .eq('id', existingItem.id);
        if (updateItemErr) throw updateItemErr;
      } else {
        // Insertar nuevo ítem en la orden existente
        const { error: insertItemErr } = await supabase
          .from('purchase_order_items')
          .insert([{
            purchase_order_id: existingOrder.id,
            ingredient_id: ingredient.id,
            ingredient_name: ingredient.name,
            quantity_ordered: neededQty,
            unit_price: unitPrice,
            tipo_corte: null
          }]);
        if (insertItemErr) throw insertItemErr;
      }

      // Recalcular total de la orden
      const newTotal = Number(existingOrder.total_cost || 0) + totalCost;
      const { error: updateOrderErr } = await supabase
        .from('purchase_orders')
        .update({ total_cost: newTotal })
        .eq('id', existingOrder.id);
      if (updateOrderErr) throw updateOrderErr;

      return { data: { orderId: existingOrder.id, merged: true }, error: null };

    } else {
      // Caso A: no existe orden activa → crear nueva
      const { data: newOrder, error: createErr } = await supabase
        .from('purchase_orders')
        .insert([{
          supplier_id: supplierId,
          budget_id: null,
          status: 'pending',
          total_cost: totalCost
        }])
        .select()
        .single();

      if (createErr || !newOrder) throw createErr || new Error('No se pudo crear la orden');

      const { error: insertItemErr } = await supabase
        .from('purchase_order_items')
        .insert([{
          purchase_order_id: newOrder.id,
          ingredient_id: ingredient.id,
          ingredient_name: ingredient.name,
          quantity_ordered: neededQty,
          unit_price: unitPrice,
          tipo_corte: null
        }]);

      if (insertItemErr) throw insertItemErr;

      return { data: { orderId: newOrder.id, merged: false }, error: null };
    }
  } catch (err) {
    console.error('smartOrderFromAlert error:', err);
    return { data: null, error: err };
  }
};

export const createPurchaseOrder = async (orderData, itemsArray) => {
  try {
    const rawSupplierId = orderData.supplier_id;
    let resolvedSupplierId = null;

    const extractUuid = (str) => {
      if (typeof str !== 'string') return null;
      const match = str.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      return match ? match[0] : null;
    };

    const resolveSupplierIdClean = (idStr) => {
      if (!idStr || typeof idStr !== 'string') return null;
      if (idStr.includes('cairo') || idStr.includes('Cairo') || idStr === 'cairo-supplier') {
        return '351af4c6-eb24-46d3-9564-8781a0d54246';
      }
      const ext = extractUuid(idStr);
      if (ext) {
        if (ext === 'd257d90b-ad0b-4f84-97a0-fee73612953c' || ext === '351af4c6-eb24-46d3-9564-8781a0d54246') {
          return '351af4c6-eb24-46d3-9564-8781a0d54246';
        }
        return ext;
      }
      if (idStr !== 'no-supplier' && idStr !== 'general') {
        return idStr;
      }
      return null;
    };

    resolvedSupplierId = resolveSupplierIdClean(rawSupplierId);

    const poPayload = {
      supplier_id: resolvedSupplierId,
      budget_id: orderData.budget_id || null,
      status: orderData.status || 'pending',
      total_cost: Number(orderData.total_cost !== undefined ? orderData.total_cost : (orderData.total_amount || 0))
    };

    console.log('📝 Insertando orden de compra en Supabase:', poPayload);

    const { data: poData, error: poErr } = await supabase
      .from('purchase_orders')
      .insert([poPayload])
      .select()
      .single();

    if (poErr || !poData) {
      console.error('❌ Error crítico insertando purchase_orders en Supabase:', poErr);
      throw poErr || new Error('Error al insertar en purchase_orders');
    }

    if (itemsArray && itemsArray.length > 0) {
      const poiRecords = itemsArray.map(item => {
        const rawIngId = item.ingredient_id || item.id;
        const resolvedIngredientId = extractUuid(rawIngId);

        return {
          purchase_order_id: poData.id,
          ingredient_id: resolvedIngredientId,
          ingredient_name: item.ingredient_name || item.name || 'Ingrediente',
          quantity_ordered: Number(item.quantity_ordered || item.quantity || item.neededQuantity || 0),
          unit_price: Number(item.unit_price || item.price_per_unit || item.unitPrice || 0),
          tipo_corte: item.tipo_corte || item.tipoCorte || null
        };
      });

      console.log(`📝 Insertando ${poiRecords.length} líneas en purchase_order_items:`, poiRecords);

      const { error: poiErr } = await supabase
        .from('purchase_order_items')
        .insert(poiRecords);

      if (poiErr) {
        console.error('❌ Error crítico insertando purchase_order_items en Supabase:', poiErr);
        throw poiErr;
      }
    }

    return { data: poData, error: null };
  } catch (err) {
    console.error('❌ Fallo al procesar la orden de compra:', err);
    return { data: null, error: err };
  }
};

export const fetchPurchaseOrders = async (statusFilter = null) => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        purchase_order_items (
          id,
          purchase_order_id,
          ingredient_id,
          ingredient_name,
          quantity_ordered,
          quantity_received,
          unit_price,
          tipo_corte,
          ingredients ( id, name, unit, purchase_price, purchase_format_gr, stock_actual, stock_reservado )
        )
      `)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      if (Array.isArray(statusFilter)) {
        query = query.in('status', statusFilter);
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    const { data: suppliersList } = await supabase.from('suppliers').select('id, name, phone, email');
    const supplierMap = {};
    (suppliersList || []).forEach(s => { supplierMap[s.id] = s; });

    const hydratedData = (data || []).map(po => ({
      ...po,
      suppliers: supplierMap[po.supplier_id] || (po.suppliers ? po.suppliers : null)
    }));

    return { data: hydratedData, error: null };
  } catch (err) {
    console.error('fetchPurchaseOrders error:', err);
    return { data: [], error: err };
  }
};

export const confirmOrderReception = async (orderId, itemsArray) => {
  try {
    // 1. Update purchase order status to 'received'
    const { error: updateErr } = await supabase
      .from('purchase_orders')
      .update({ status: 'received', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updateErr) {
      console.error('Error actualizando estado de la orden:', updateErr);
    }

    // 2. Update ingredient stock_actual & stock_reservado
    const resVal = await validarRecepcionPedido(itemsArray);
    return resVal;
  } catch (err) {
    return { error: err };
  }
};

export const deletePurchaseOrder = async (orderId) => {
  try {
    // 1. Delete order items first
    const { error: itemsErr } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('purchase_order_id', orderId);

    if (itemsErr) throw itemsErr;

    // 2. Delete parent order
    const { error: poErr } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', orderId);

    if (poErr) throw poErr;

    return { success: true, error: null };
  } catch (err) {
    console.error('❌ Error al eliminar la orden de compra:', err);
    return { success: false, error: err };
  }
};

export const resetearCompras = async () => {
  try {
    const { error: itemsErr } = await supabase
      .from('purchase_order_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (itemsErr) throw itemsErr;

    const { error: ordersErr } = await supabase
      .from('purchase_orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (ordersErr) throw ordersErr;

    return { success: true, error: null };
  } catch (err) {
    console.error('❌ Error al resetear compras:', err);
    return { success: false, error: err };
  }
};
