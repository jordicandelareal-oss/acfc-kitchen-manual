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

// ── Guardar menú borrador (Sin alterar stock_reservado) ──
export const guardarMenuBorrador = async (menuDays) => {
  try {
    const res = await supabase.rpc('guardar_menu_borrador', { p_menu_days: menuDays });
    if (!res?.error) return res;
  } catch (e) {
    console.warn('RPC guardar_menu_borrador fallo, ejecutando fallback JS:', e);
  }

  try {
    const upserts = menuDays.map(item => ({
      date: item.date,
      breakfast_recipe_id: item.breakfast_recipe_id || null,
      lunch_recipe_id: item.lunch_recipe_id || null,
      lunch_side_recipe_id: item.lunch_side_recipe_id || null,
      dinner_recipe_id: item.dinner_recipe_id || null,
      lunch_players: Number(item.lunch_players) || 25,
      dinner_players: Number(item.dinner_players) || 20,
      lunch_halal: Number(item.lunch_halal) || 0,
      lunch_kosher: Number(item.lunch_kosher) || 0,
      lunch_vegan: Number(item.lunch_vegan) || 0,
      lunch_allergies: item.lunch_allergies || '',
      dinner_halal: Number(item.dinner_halal) || 0,
      dinner_kosher: Number(item.dinner_kosher) || 0,
      dinner_vegan: Number(item.dinner_vegan) || 0,
      dinner_allergies: item.dinner_allergies || '',
      confirmado: false,
      updated_at: new Date().toISOString()
    }));

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

// ── Guardar y Confirmar menú (Reserva stock_reservado explícitamente) ──
export const guardarYConfirmarMenu = async (menuDays) => {
  try {
    const res = await supabase.rpc('guardar_y_confirmar_menu', { p_menu_days: menuDays });
    if (!res?.error) return res;
  } catch (e) {
    console.warn('RPC guardar_y_confirmar_menu fallo, ejecutando fallback JS:', e);
  }

  try {
    const upserts = menuDays.map(item => ({
      date: item.date,
      breakfast_recipe_id: item.breakfast_recipe_id || null,
      lunch_recipe_id: item.lunch_recipe_id || null,
      lunch_side_recipe_id: item.lunch_side_recipe_id || null,
      dinner_recipe_id: item.dinner_recipe_id || null,
      lunch_players: Number(item.lunch_players) || 25,
      dinner_players: Number(item.dinner_players) || 20,
      confirmado: true,
      updated_at: new Date().toISOString()
    }));

    const { error: upsertErr } = await supabase
      .from('menu_planner')
      .upsert(upserts, { onConflict: 'date' });

    if (upsertErr) return { error: upsertErr };

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
  return supabase.rpc('generar_lista_compras_optimizada');
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
