import { supabase } from './supabaseClient';

// ── Menús: planning semanal ────────────────────────────────────────────────
export const fetchMenus = async () => {
  try {
    const { data, error } = await supabase
      .from('menu_planning')
      .select('*')
      .order('planning_date', { ascending: true })
      .limit(30);
    if (error) throw error;
    return { success: true, items: data || [] };
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
      .select('id, name, unit, current_stock, min_stock, precio_mas_bajo, proveedor_principal')
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
        updated_at
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
    if (fields.precio_por_kg    != null) patch.precio_por_kg    = parseFloat(fields.precio_por_kg);
    if (fields.precio_por_u     != null) patch.precio_por_u     = parseFloat(fields.precio_por_u);
    if (fields.precio_mas_bajo  != null) patch.precio_mas_bajo  = parseFloat(fields.precio_mas_bajo);
    if (fields.proveedor_principal != null) patch.proveedor_principal = fields.proveedor_principal;

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
