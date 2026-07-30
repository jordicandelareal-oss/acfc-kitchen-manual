-- MIGRATION 021: Fix Dual Track Ingredients Isolation
-- Asegurar que las listas de la compra e inventario utilicen estrictamente la receta vegetariana para su porción.
-- Eliminar versiones antiguas que podrían estar interfiriendo.

DROP FUNCTION IF EXISTS public.generar_lista_compras_optimizada();
CREATE OR REPLACE FUNCTION public.generar_lista_compras_optimizada()
RETURNS TABLE (
  fila_id uuid,
  nombre_ingrediente varchar,
  proveedor varchar,
  corte varchar,
  cantidad_necesaria numeric,
  a_comprar numeric,
  stock_actual numeric,
  destinations text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  temp_row record;
  db_stock numeric;
  v_veg_count integer;
BEGIN
  v_veg_count := public.get_active_vegetarians();

  CREATE TEMP TABLE temp_needs (
    id uuid DEFAULT gen_random_uuid(),
    ing_id uuid,
    ing_name varchar,
    ing_unit varchar,
    supp_name varchar,
    supp_id uuid,
    supp_phone varchar,
    supp_email varchar,
    is_cairo boolean,
    corte varchar,
    qty numeric,
    dest text
  ) ON COMMIT DROP;

  -- ================== DESAYUNO ==================
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * GREATEST(0, COALESCE(mp.breakfast_players, 20) - v_veg_count),
    (r.name || ' (Desayuno Estándar)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.breakfast_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE GREATEST(0, COALESCE(mp.breakfast_players, 20) - v_veg_count) > 0;

  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * LEAST(COALESCE(mp.breakfast_players, 20), v_veg_count),
    (r.name || ' (Desayuno Veg)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = public.get_vegetarian_alternative(mp.breakfast_recipe_id)
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE LEAST(COALESCE(mp.breakfast_players, 20), v_veg_count) > 0;

  -- ================== ALMUERZO ==================
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * GREATEST(0, mp.lunch_players - v_veg_count),
    (r.name || ' (Almuerzo Estándar)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0 AND GREATEST(0, mp.lunch_players - v_veg_count) > 0;

  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * LEAST(mp.lunch_players, v_veg_count),
    (r.name || ' (Almuerzo Veg)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = public.get_vegetarian_alternative(mp.lunch_recipe_id)
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0 AND LEAST(mp.lunch_players, v_veg_count) > 0;

  -- ================== GUARNICIÓN ==================
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * GREATEST(0, mp.lunch_players - v_veg_count),
    (r.name || ' (Guarnición Estándar)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_side_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0 AND GREATEST(0, mp.lunch_players - v_veg_count) > 0;

  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * LEAST(mp.lunch_players, v_veg_count),
    (r.name || ' (Guarnición Veg)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = public.get_vegetarian_alternative(mp.lunch_side_recipe_id)
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0 AND LEAST(mp.lunch_players, v_veg_count) > 0;

  -- ================== CENA ==================
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * GREATEST(0, mp.dinner_players - v_veg_count),
    (r.name || ' (Cena Estándar)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.dinner_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.dinner_players > 0 AND GREATEST(0, mp.dinner_players - v_veg_count) > 0;

  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * LEAST(mp.dinner_players, v_veg_count),
    (r.name || ' (Cena Veg)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = public.get_vegetarian_alternative(mp.dinner_recipe_id)
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.dinner_players > 0 AND LEAST(mp.dinner_players, v_veg_count) > 0;

  -- ── FLUJO A: CARNICERÍA EL CAIRO ──
  FOR temp_row IN 
    SELECT 
      tn.ing_id, tn.ing_name, tn.supp_name, tn.corte, 
      SUM(tn.qty) as total_qty, string_agg(distinct tn.dest, ', ') as all_dests
    FROM temp_needs tn
    WHERE tn.is_cairo = true
    GROUP BY tn.ing_id, tn.ing_name, tn.supp_name, tn.corte
    ORDER BY tn.ing_name ASC
  LOOP
    fila_id := temp_row.ing_id;
    nombre_ingrediente := temp_row.ing_name::varchar;
    proveedor := 'Carnicería El Cairo'::varchar;
    corte := temp_row.corte::varchar;
    cantidad_necesaria := temp_row.total_qty::numeric;

    SELECT COALESCE(ingredients.stock_actual, 0) INTO db_stock FROM public.ingredients WHERE id = temp_row.ing_id;
    stock_actual := db_stock::numeric;
    a_comprar := GREATEST(0, cantidad_necesaria - db_stock)::numeric;
    destinations := temp_row.all_dests::text;

    RETURN NEXT;
  END LOOP;

  -- ── FLUJO B: RESTO DE PROVEEDORES ──
  FOR temp_row IN 
    SELECT 
      tn.ing_id, tn.ing_name, tn.supp_name, 
      SUM(tn.qty) as total_qty, string_agg(distinct tn.dest, ', ') as all_dests
    FROM temp_needs tn
    WHERE tn.is_cairo = false
    GROUP BY tn.ing_id, tn.ing_name, tn.supp_name
    ORDER BY tn.ing_name ASC
  LOOP
    fila_id := temp_row.ing_id;
    nombre_ingrediente := temp_row.ing_name::varchar;
    proveedor := COALESCE(temp_row.supp_name, 'Sin proveedor asignado')::varchar;
    corte := ''::varchar;
    cantidad_necesaria := temp_row.total_qty::numeric;

    SELECT COALESCE(ingredients.stock_actual, 0) INTO db_stock FROM public.ingredients WHERE id = temp_row.ing_id;
    stock_actual := db_stock::numeric;
    a_comprar := GREATEST(0, cantidad_necesaria - db_stock)::numeric;
    destinations := temp_row.all_dests::text;

    RETURN NEXT;
  END LOOP;
END;
$$;
-- MIGRATION 019: Dual Track Logistics (Option B) for Vegetarian Alternatives (Part 2)

-- Function 4: guardar_menu_borrador (update stock release logic)
CREATE OR REPLACE FUNCTION public.guardar_menu_borrador(p_menu_days JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_record JSONB;
  target_date DATE;
  v_old_rec record;
  v_ing record;
  v_qty numeric;
  v_veg_count integer;
  v_std_players integer;
  v_veg_players integer;
BEGIN
  v_veg_count := public.get_active_vegetarians();

  FOR day_record IN SELECT * FROM jsonb_array_elements(p_menu_days)
  LOOP
    target_date := (day_record->>'date')::DATE;
    IF target_date IS NULL THEN CONTINUE; END IF;

    -- If day was previously confirmed, release its reserved stock first
    SELECT * INTO v_old_rec FROM public.menu_planner WHERE date = target_date;
    IF FOUND AND COALESCE(v_old_rec.confirmado, false) = true THEN
      
      -- Release Breakfast
      IF v_old_rec.breakfast_recipe_id IS NOT NULL THEN
        v_std_players := GREATEST(0, COALESCE(v_old_rec.breakfast_players, 20) - v_veg_count);
        v_veg_players := LEAST(COALESCE(v_old_rec.breakfast_players, 20), v_veg_count);
        -- Standard
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_old_rec.breakfast_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        -- Veg
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_old_rec.breakfast_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Release Lunch
      IF v_old_rec.lunch_recipe_id IS NOT NULL AND COALESCE(v_old_rec.lunch_players, 0) > 0 THEN
        v_std_players := GREATEST(0, v_old_rec.lunch_players - v_veg_count);
        v_veg_players := LEAST(v_old_rec.lunch_players, v_veg_count);
        -- Standard
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_old_rec.lunch_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        -- Veg
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_old_rec.lunch_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Release Lunch Side
      IF v_old_rec.lunch_side_recipe_id IS NOT NULL AND COALESCE(v_old_rec.lunch_players, 0) > 0 THEN
        v_std_players := GREATEST(0, v_old_rec.lunch_players - v_veg_count);
        v_veg_players := LEAST(v_old_rec.lunch_players, v_veg_count);
        -- Standard
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_old_rec.lunch_side_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        -- Veg
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_old_rec.lunch_side_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Release Dinner
      IF v_old_rec.dinner_recipe_id IS NOT NULL AND COALESCE(v_old_rec.dinner_players, 0) > 0 THEN
        v_std_players := GREATEST(0, v_old_rec.dinner_players - v_veg_count);
        v_veg_players := LEAST(v_old_rec.dinner_players, v_veg_count);
        -- Standard
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_old_rec.dinner_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        -- Veg
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_old_rec.dinner_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;
    END IF;

    INSERT INTO public.menu_planner (
      date, breakfast_recipe_id, lunch_recipe_id, lunch_side_recipe_id, dinner_recipe_id,
      lunch_players, lunch_halal, lunch_kosher, lunch_vegan, lunch_allergies,
      dinner_players, dinner_halal, dinner_kosher, dinner_vegan, dinner_allergies, confirmado
    )
    VALUES (
      target_date,
      (day_record->>'breakfast_recipe_id')::UUID,
      (day_record->>'lunch_recipe_id')::UUID,
      (day_record->>'lunch_side_recipe_id')::UUID,
      (day_record->>'dinner_recipe_id')::UUID,
      COALESCE((day_record->>'lunch_players')::INTEGER, 25),
      COALESCE((day_record->>'lunch_halal')::INTEGER, 0),
      COALESCE((day_record->>'lunch_kosher')::INTEGER, 0),
      COALESCE((day_record->>'lunch_vegan')::INTEGER, 0),
      COALESCE(day_record->>'lunch_allergies', ''),
      COALESCE((day_record->>'dinner_players')::INTEGER, 20),
      COALESCE((day_record->>'dinner_halal')::INTEGER, 0),
      COALESCE((day_record->>'dinner_kosher')::INTEGER, 0),
      COALESCE((day_record->>'dinner_vegan')::INTEGER, 0),
      COALESCE(day_record->>'dinner_allergies', ''),
      false
    )
    ON CONFLICT (date)
    DO UPDATE SET
      breakfast_recipe_id = EXCLUDED.breakfast_recipe_id,
      lunch_recipe_id = EXCLUDED.lunch_recipe_id,
      lunch_side_recipe_id = EXCLUDED.lunch_side_recipe_id,
      dinner_recipe_id = EXCLUDED.dinner_recipe_id,
      lunch_players = EXCLUDED.lunch_players,
      lunch_halal = EXCLUDED.lunch_halal,
      lunch_kosher = EXCLUDED.lunch_kosher,
      lunch_vegan = EXCLUDED.lunch_vegan,
      lunch_allergies = EXCLUDED.lunch_allergies,
      dinner_players = EXCLUDED.dinner_players,
      dinner_halal = EXCLUDED.dinner_halal,
      dinner_kosher = EXCLUDED.dinner_kosher,
      dinner_vegan = EXCLUDED.dinner_vegan,
      dinner_allergies = EXCLUDED.dinner_allergies,
      confirmado = false,
      updated_at = NOW();
  END LOOP;
END;
$$;
-- MIGRATION 019: Dual Track Logistics (Option B) for Vegetarian Alternatives (Part 3)

-- Function 5: guardar_y_confirmar_menu
CREATE OR REPLACE FUNCTION public.guardar_y_confirmar_menu(p_menu_days JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_record JSONB;
  target_date DATE;
  v_old_rec record;
  v_rec record;
  v_ing record;
  v_qty numeric;
  v_confirmed_count integer := 0;
  v_veg_count integer;
  v_std_players integer;
  v_veg_players integer;
BEGIN
  v_veg_count := public.get_active_vegetarians();

  FOR day_record IN SELECT * FROM jsonb_array_elements(p_menu_days)
  LOOP
    target_date := (day_record->>'date')::DATE;
    IF target_date IS NULL THEN CONTINUE; END IF;

    -- STEP 1: If day was previously confirmed, release its existing stock reservations first
    SELECT * INTO v_old_rec FROM public.menu_planner WHERE date = target_date;
    IF FOUND AND COALESCE(v_old_rec.confirmado, false) = true THEN
      
      -- Release Breakfast
      IF v_old_rec.breakfast_recipe_id IS NOT NULL THEN
        v_std_players := GREATEST(0, COALESCE(v_old_rec.breakfast_players, 20) - v_veg_count);
        v_veg_players := LEAST(COALESCE(v_old_rec.breakfast_players, 20), v_veg_count);
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_old_rec.breakfast_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_old_rec.breakfast_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Release Lunch
      IF v_old_rec.lunch_recipe_id IS NOT NULL AND COALESCE(v_old_rec.lunch_players, 0) > 0 THEN
        v_std_players := GREATEST(0, v_old_rec.lunch_players - v_veg_count);
        v_veg_players := LEAST(v_old_rec.lunch_players, v_veg_count);
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_old_rec.lunch_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_old_rec.lunch_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Release Lunch Side
      IF v_old_rec.lunch_side_recipe_id IS NOT NULL AND COALESCE(v_old_rec.lunch_players, 0) > 0 THEN
        v_std_players := GREATEST(0, v_old_rec.lunch_players - v_veg_count);
        v_veg_players := LEAST(v_old_rec.lunch_players, v_veg_count);
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_old_rec.lunch_side_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_old_rec.lunch_side_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Release Dinner
      IF v_old_rec.dinner_recipe_id IS NOT NULL AND COALESCE(v_old_rec.dinner_players, 0) > 0 THEN
        v_std_players := GREATEST(0, v_old_rec.dinner_players - v_veg_count);
        v_veg_players := LEAST(v_old_rec.dinner_players, v_veg_count);
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_old_rec.dinner_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_old_rec.dinner_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;
    END IF;

    -- STEP 2: Upsert menu planner record as confirmed
    INSERT INTO public.menu_planner (
      date, breakfast_recipe_id, lunch_recipe_id, lunch_side_recipe_id, dinner_recipe_id,
      lunch_players, dinner_players, confirmado,
      lunch_halal, lunch_kosher, lunch_vegan, lunch_allergies,
      dinner_halal, dinner_kosher, dinner_vegan, dinner_allergies
    )
    VALUES (
      target_date,
      (day_record->>'breakfast_recipe_id')::UUID,
      (day_record->>'lunch_recipe_id')::UUID,
      (day_record->>'lunch_side_recipe_id')::UUID,
      (day_record->>'dinner_recipe_id')::UUID,
      COALESCE((day_record->>'lunch_players')::INTEGER, 25),
      COALESCE((day_record->>'dinner_players')::INTEGER, 20),
      true,
      COALESCE((day_record->>'lunch_halal')::INTEGER, 0),
      COALESCE((day_record->>'lunch_kosher')::INTEGER, 0),
      COALESCE((day_record->>'lunch_vegan')::INTEGER, 0),
      COALESCE(day_record->>'lunch_allergies', ''),
      COALESCE((day_record->>'dinner_halal')::INTEGER, 0),
      COALESCE((day_record->>'dinner_kosher')::INTEGER, 0),
      COALESCE((day_record->>'dinner_vegan')::INTEGER, 0),
      COALESCE(day_record->>'dinner_allergies', '')
    )
    ON CONFLICT (date)
    DO UPDATE SET
      breakfast_recipe_id = EXCLUDED.breakfast_recipe_id,
      lunch_recipe_id = EXCLUDED.lunch_recipe_id,
      lunch_side_recipe_id = EXCLUDED.lunch_side_recipe_id,
      dinner_recipe_id = EXCLUDED.dinner_recipe_id,
      lunch_players = EXCLUDED.lunch_players,
      dinner_players = EXCLUDED.dinner_players,
      confirmado = true,
      lunch_halal = EXCLUDED.lunch_halal,
      lunch_kosher = EXCLUDED.lunch_kosher,
      lunch_vegan = EXCLUDED.lunch_vegan,
      lunch_allergies = EXCLUDED.lunch_allergies,
      dinner_halal = EXCLUDED.dinner_halal,
      dinner_kosher = EXCLUDED.dinner_kosher,
      dinner_vegan = EXCLUDED.dinner_vegan,
      dinner_allergies = EXCLUDED.dinner_allergies,
      updated_at = NOW();

    -- STEP 3: Add new reservations for updated confirmed menu
    SELECT * INTO v_rec FROM public.menu_planner WHERE date = target_date;

    -- A. Reserve Breakfast
    IF v_rec.breakfast_recipe_id IS NOT NULL THEN
      v_std_players := GREATEST(0, COALESCE(v_rec.breakfast_players, 20) - v_veg_count);
      v_veg_players := LEAST(COALESCE(v_rec.breakfast_players, 20), v_veg_count);
      IF v_std_players > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.breakfast_recipe_id LOOP
          v_qty := (v_ing.quantity_per_portion * v_std_players);
          UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;
      IF v_veg_players > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.breakfast_recipe_id) LOOP
          v_qty := (v_ing.quantity_per_portion * v_veg_players);
          UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;
    END IF;

    -- B. Reserve Lunch
    IF v_rec.lunch_recipe_id IS NOT NULL AND COALESCE(v_rec.lunch_players, 0) > 0 THEN
      v_std_players := GREATEST(0, v_rec.lunch_players - v_veg_count);
      v_veg_players := LEAST(v_rec.lunch_players, v_veg_count);
      IF v_std_players > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_recipe_id LOOP
          v_qty := (v_ing.quantity_per_portion * v_std_players);
          UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;
      IF v_veg_players > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.lunch_recipe_id) LOOP
          v_qty := (v_ing.quantity_per_portion * v_veg_players);
          UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;
    END IF;

    -- C. Reserve Lunch Side
    IF v_rec.lunch_side_recipe_id IS NOT NULL AND COALESCE(v_rec.lunch_players, 0) > 0 THEN
      v_std_players := GREATEST(0, v_rec.lunch_players - v_veg_count);
      v_veg_players := LEAST(v_rec.lunch_players, v_veg_count);
      IF v_std_players > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_side_recipe_id LOOP
          v_qty := (v_ing.quantity_per_portion * v_std_players);
          UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;
      IF v_veg_players > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.lunch_side_recipe_id) LOOP
          v_qty := (v_ing.quantity_per_portion * v_veg_players);
          UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;
    END IF;

    -- D. Reserve Dinner
    IF v_rec.dinner_recipe_id IS NOT NULL AND COALESCE(v_rec.dinner_players, 0) > 0 THEN
      v_std_players := GREATEST(0, v_rec.dinner_players - v_veg_count);
      v_veg_players := LEAST(v_rec.dinner_players, v_veg_count);
      IF v_std_players > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.dinner_recipe_id LOOP
          v_qty := (v_ing.quantity_per_portion * v_std_players);
          UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;
      IF v_veg_players > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.dinner_recipe_id) LOOP
          v_qty := (v_ing.quantity_per_portion * v_veg_players);
          UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;
    END IF;

    v_confirmed_count := v_confirmed_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'confirmed_count', v_confirmed_count);
END;
$$;
-- MIGRATION 019: Dual Track Logistics (Option B) for Vegetarian Alternatives (Part 4)

-- Function 6: eliminar_menu_y_liberar_stock
CREATE OR REPLACE FUNCTION public.eliminar_menu_y_liberar_stock(p_dates DATE[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_date DATE;
  v_rec record;
  v_ing record;
  v_qty numeric;
  v_released_count integer := 0;
  v_veg_count integer;
  v_std_players integer;
  v_veg_players integer;
BEGIN
  v_veg_count := public.get_active_vegetarians();

  FOREACH target_date IN ARRAY p_dates
  LOOP
    SELECT * INTO v_rec FROM public.menu_planner WHERE date = target_date;
    IF FOUND THEN
      -- Release Breakfast
      IF v_rec.breakfast_recipe_id IS NOT NULL THEN
        v_std_players := GREATEST(0, COALESCE(v_rec.breakfast_players, 20) - v_veg_count);
        v_veg_players := LEAST(COALESCE(v_rec.breakfast_players, 20), v_veg_count);
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.breakfast_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.breakfast_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Release Lunch
      IF v_rec.lunch_recipe_id IS NOT NULL AND COALESCE(v_rec.lunch_players, 0) > 0 THEN
        v_std_players := GREATEST(0, v_rec.lunch_players - v_veg_count);
        v_veg_players := LEAST(v_rec.lunch_players, v_veg_count);
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.lunch_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Release Lunch Side
      IF v_rec.lunch_side_recipe_id IS NOT NULL AND COALESCE(v_rec.lunch_players, 0) > 0 THEN
        v_std_players := GREATEST(0, v_rec.lunch_players - v_veg_count);
        v_veg_players := LEAST(v_rec.lunch_players, v_veg_count);
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_side_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.lunch_side_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Release Dinner
      IF v_rec.dinner_recipe_id IS NOT NULL AND COALESCE(v_rec.dinner_players, 0) > 0 THEN
        v_std_players := GREATEST(0, v_rec.dinner_players - v_veg_count);
        v_veg_players := LEAST(v_rec.dinner_players, v_veg_count);
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.dinner_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.dinner_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
          END LOOP;
        END IF;
      END IF;

      -- Delete planner entry
      DELETE FROM public.menu_planner WHERE date = target_date;
      v_released_count := v_released_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'released_count', v_released_count);
END;
$$;


-- Function 7: simular_cierre_turno
CREATE OR REPLACE FUNCTION public.simular_cierre_turno(p_date DATE, p_shift TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec record;
  v_ing record;
  v_qty numeric;
  v_count integer := 0;
  v_log text := '';
  v_veg_count integer;
  v_std_players integer;
  v_veg_players integer;
BEGIN
  v_veg_count := public.get_active_vegetarians();
  SELECT * INTO v_rec FROM public.menu_planner WHERE date = p_date;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No hay menú planificado para la fecha ' || p_date::text);
  END IF;

  IF p_shift = 'lunch' THEN
    IF COALESCE(v_rec.lunch_players, 0) > 0 THEN
      v_std_players := GREATEST(0, v_rec.lunch_players - v_veg_count);
      v_veg_players := LEAST(v_rec.lunch_players, v_veg_count);

      -- Main Lunch Recipe
      IF v_rec.lunch_recipe_id IS NOT NULL THEN
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_actual = COALESCE(stock_actual, 0) - v_qty, stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
            v_count := v_count + 1;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.lunch_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_actual = COALESCE(stock_actual, 0) - v_qty, stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
            v_count := v_count + 1;
          END LOOP;
        END IF;
      END IF;

      -- Side Lunch Recipe
      IF v_rec.lunch_side_recipe_id IS NOT NULL THEN
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_side_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_actual = COALESCE(stock_actual, 0) - v_qty, stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
            v_count := v_count + 1;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.lunch_side_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_actual = COALESCE(stock_actual, 0) - v_qty, stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
            v_count := v_count + 1;
          END LOOP;
        END IF;
      END IF;
    END IF;

    UPDATE public.menu_planner SET lunch_processed = true, updated_at = NOW() WHERE id = v_rec.id;
    v_log := 'Descuento de Almuerzo ejecutado para fecha ' || p_date::text;

  ELSIF p_shift = 'dinner' THEN
    IF COALESCE(v_rec.dinner_players, 0) > 0 THEN
      v_std_players := GREATEST(0, v_rec.dinner_players - v_veg_count);
      v_veg_players := LEAST(v_rec.dinner_players, v_veg_count);
      
      IF v_rec.dinner_recipe_id IS NOT NULL THEN
        IF v_std_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.dinner_recipe_id LOOP
            v_qty := (v_ing.quantity_per_portion * v_std_players);
            UPDATE public.ingredients SET stock_actual = COALESCE(stock_actual, 0) - v_qty, stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
            v_count := v_count + 1;
          END LOOP;
        END IF;
        IF v_veg_players > 0 THEN
          FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = public.get_vegetarian_alternative(v_rec.dinner_recipe_id) LOOP
            v_qty := (v_ing.quantity_per_portion * v_veg_players);
            UPDATE public.ingredients SET stock_actual = COALESCE(stock_actual, 0) - v_qty, stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
            v_count := v_count + 1;
          END LOOP;
        END IF;
      END IF;
    END IF;

    UPDATE public.menu_planner SET dinner_processed = true, updated_at = NOW() WHERE id = v_rec.id;
    v_log := 'Descuento de Cena ejecutado para fecha ' || p_date::text;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Turno no válido. Use lunch o dinner.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'shift', p_shift,
    'date', p_date,
    'ingredients_updated', v_count,
    'log', v_log
  );
END;
$$;
