import { supabase } from './supabaseClient';

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
      .select('id, name, unit, current_stock, min_stock, stock_actual, stock_minimo, stock_maximo, precio_mas_bajo, proveedor_principal, supplier_id, stock_reservado')
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
export const fetchPlannerDataDb = async () => {
  return supabase.from('menu_planner').select(`
    *,
    breakfast_recipe:recipes!breakfast_recipe_id(id, name, image_url),
    lunch_recipe:recipes!lunch_recipe_id(id, name, image_url),
    lunch_side_recipe:recipes!lunch_side_recipe_id(id, name, image_url),
    dinner_recipe:recipes!dinner_recipe_id(id, name, image_url)
  `);
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

export const guardarYConfirmarMenu = async (menuDays) => {
  return supabase.rpc('guardar_y_confirmar_menu', { p_menu_days: menuDays });
};

export const guardarMenuYReservarStock = async (menuDays) => {
  return supabase.rpc('guardar_menu_y_reservar_stock', { p_menu_days: menuDays });
};

export const eliminarMenuYLiberarStock = async (datesArray) => {
  return supabase.rpc('eliminar_menu_y_liberar_stock', { p_dates: datesArray });
};

export const generarListaComprasOptimizada = async () => {
  return supabase.rpc('generar_lista_compras_optimizada');
};

export const liberarStockReservado = async (recipeId, comensales) => {
  return supabase.rpc('liberar_stock_reservado', { p_recipe_id: recipeId, p_comensales: comensales });
};

export const procesarDescuentosAutomaticosTurnos = async () => {
  try {
    const res = await supabase.rpc('procesar_descuentos_automaticos_turnos');
    if (res.error && (res.error.code === 'PGRST202' || res.error.message?.includes('404') || res.error.details?.includes('function'))) {
      console.warn('[API] RPC procesar_descuentos_automaticos_turnos no encontrada en Supabase remoto. Omitiendo.');
      return { data: { processed_count: 0 }, error: null };
    }
    return res;
  } catch (err) {
    console.warn('[API] Error al ejecutar procesar_descuentos_automaticos_turnos:', err);
    return { data: { processed_count: 0 }, error: null };
  }
};
