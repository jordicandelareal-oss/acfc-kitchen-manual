-- MIGRATION 016: Stock Reservation Rules, Order Reception & Testing Toolbar RPCs

-- Drop existing functions to allow return type and signature changes
DROP FUNCTION IF EXISTS guardar_menu_borrador(jsonb);
DROP FUNCTION IF EXISTS guardar_y_confirmar_menu(jsonb);
DROP FUNCTION IF EXISTS eliminar_menu_y_liberar_stock(date[]);
DROP FUNCTION IF EXISTS validar_recepcion_pedido(jsonb);
DROP FUNCTION IF EXISTS simular_cierre_turno(date, text);
DROP FUNCTION IF EXISTS resetear_entorno_pruebas();

-- 1. RPC: guardar_menu_borrador
-- Saves menu planner items as draft WITHOUT touching ingredients.stock_reservado
CREATE OR REPLACE FUNCTION guardar_menu_borrador(p_menu_days JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_record JSONB;
  target_date DATE;
BEGIN
  FOR day_record IN SELECT * FROM jsonb_array_elements(p_menu_days)
  LOOP
    target_date := (day_record->>'date')::DATE;
    IF target_date IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.menu_planner (
      date,
      breakfast_recipe_id,
      lunch_recipe_id,
      lunch_side_recipe_id,
      dinner_recipe_id,
      lunch_players,
      lunch_halal,
      lunch_kosher,
      lunch_vegan,
      lunch_allergies,
      dinner_players,
      dinner_halal,
      dinner_kosher,
      dinner_vegan,
      dinner_allergies,
      confirmado
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
      updated_at = NOW();
  END LOOP;
END;
$$;


-- 2. RPC: guardar_y_confirmar_menu
-- Saves menu planner items and marks them confirmed, reserving stock in ingredients
CREATE OR REPLACE FUNCTION guardar_y_confirmar_menu(p_menu_days JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_record JSONB;
  target_date DATE;
  v_rec record;
  v_ing record;
  v_qty numeric;
  v_confirmed_count integer := 0;
BEGIN
  FOR day_record IN SELECT * FROM jsonb_array_elements(p_menu_days)
  LOOP
    target_date := (day_record->>'date')::DATE;
    IF target_date IS NULL THEN CONTINUE; END IF;

    -- Upsert menu planner record as confirmed
    INSERT INTO public.menu_planner (
      date,
      breakfast_recipe_id,
      lunch_recipe_id,
      lunch_side_recipe_id,
      dinner_recipe_id,
      lunch_players,
      dinner_players,
      confirmado
    )
    VALUES (
      target_date,
      (day_record->>'breakfast_recipe_id')::UUID,
      (day_record->>'lunch_recipe_id')::UUID,
      (day_record->>'lunch_side_recipe_id')::UUID,
      (day_record->>'dinner_recipe_id')::UUID,
      COALESCE((day_record->>'lunch_players')::INTEGER, 25),
      COALESCE((day_record->>'dinner_players')::INTEGER, 20),
      true
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
      updated_at = NOW();

    -- Fetch current record
    SELECT * INTO v_rec FROM public.menu_planner WHERE date = target_date;

    -- A. Reserve Breakfast
    IF v_rec.breakfast_recipe_id IS NOT NULL THEN
      FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.breakfast_recipe_id
      LOOP
        v_qty := (v_ing.quantity_per_portion * COALESCE(v_rec.breakfast_players, 20));
        UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
      END LOOP;
    END IF;

    -- B. Reserve Lunch
    IF v_rec.lunch_recipe_id IS NOT NULL AND COALESCE(v_rec.lunch_players, 0) > 0 THEN
      FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_recipe_id
      LOOP
        v_qty := (v_ing.quantity_per_portion * v_rec.lunch_players);
        UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
      END LOOP;
    END IF;

    -- C. Reserve Lunch Side
    IF v_rec.lunch_side_recipe_id IS NOT NULL AND COALESCE(v_rec.lunch_players, 0) > 0 THEN
      FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_side_recipe_id
      LOOP
        v_qty := (v_ing.quantity_per_portion * v_rec.lunch_players);
        UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
      END LOOP;
    END IF;

    -- D. Reserve Dinner
    IF v_rec.dinner_recipe_id IS NOT NULL AND COALESCE(v_rec.dinner_players, 0) > 0 THEN
      FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.dinner_recipe_id
      LOOP
        v_qty := (v_ing.quantity_per_portion * v_rec.dinner_players);
        UPDATE public.ingredients SET stock_reservado = COALESCE(stock_reservado, 0) + v_qty, updated_at = NOW() WHERE id = v_ing.ingredient_id;
      END LOOP;
    END IF;

    v_confirmed_count := v_confirmed_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'confirmed_count', v_confirmed_count);
END;
$$;


-- 3. RPC: eliminar_menu_y_liberar_stock
-- Releases reserved stock when deleting dishes or clearing dates
CREATE OR REPLACE FUNCTION eliminar_menu_y_liberar_stock(p_dates DATE[])
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
BEGIN
  FOREACH target_date IN ARRAY p_dates
  LOOP
    SELECT * INTO v_rec FROM public.menu_planner WHERE date = target_date;
    IF FOUND THEN
      -- Release Breakfast
      IF v_rec.breakfast_recipe_id IS NOT NULL THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.breakfast_recipe_id
        LOOP
          v_qty := (v_ing.quantity_per_portion * COALESCE(v_rec.breakfast_players, 20));
          UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;

      -- Release Lunch
      IF v_rec.lunch_recipe_id IS NOT NULL AND COALESCE(v_rec.lunch_players, 0) > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_recipe_id
        LOOP
          v_qty := (v_ing.quantity_per_portion * v_rec.lunch_players);
          UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;

      -- Release Lunch Side
      IF v_rec.lunch_side_recipe_id IS NOT NULL AND COALESCE(v_rec.lunch_players, 0) > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_side_recipe_id
        LOOP
          v_qty := (v_ing.quantity_per_portion * v_rec.lunch_players);
          UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;

      -- Release Dinner
      IF v_rec.dinner_recipe_id IS NOT NULL AND COALESCE(v_rec.dinner_players, 0) > 0 THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.dinner_recipe_id
        LOOP
          v_qty := (v_ing.quantity_per_portion * v_rec.dinner_players);
          UPDATE public.ingredients SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty), updated_at = NOW() WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;

      -- Delete planner entry
      DELETE FROM public.menu_planner WHERE date = target_date;
      v_released_count := v_released_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'released_count', v_released_count);
END;
$$;


-- 4. RPC: validar_recepcion_pedido
-- Validates purchase order reception and updates stock_actual & stock_reservado atomically
CREATE OR REPLACE FUNCTION validar_recepcion_pedido(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_ing_id UUID;
  v_qty NUMERIC;
  v_updated_count INTEGER := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_ing_id := (v_item->>'ingredient_id')::UUID;
    v_qty := COALESCE((v_item->>'cantidad_recibida')::NUMERIC, 0);

    IF v_ing_id IS NOT NULL AND v_qty > 0 THEN
      UPDATE public.ingredients
      SET 
        stock_actual = COALESCE(stock_actual, 0) + v_qty,
        stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty),
        updated_at = NOW()
      WHERE id = v_ing_id;

      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated_count);
END;
$$;


-- 5. RPC: simular_cierre_turno
-- Simulates shift closure for lunch or dinner immediately
CREATE OR REPLACE FUNCTION simular_cierre_turno(p_date DATE, p_shift TEXT)
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
BEGIN
  SELECT * INTO v_rec FROM public.menu_planner WHERE date = p_date;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No hay menú planificado para la fecha ' || p_date::text);
  END IF;

  IF p_shift = 'lunch' THEN
    IF COALESCE(v_rec.lunch_players, 0) > 0 THEN
      -- Main Lunch Recipe
      IF v_rec.lunch_recipe_id IS NOT NULL THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_recipe_id
        LOOP
          v_qty := (v_ing.quantity_per_portion * v_rec.lunch_players);
          UPDATE public.ingredients 
          SET stock_actual = COALESCE(stock_actual, 0) - v_qty,
              stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty),
              updated_at = NOW()
          WHERE id = v_ing.ingredient_id;
          v_count := v_count + 1;
        END LOOP;
      END IF;

      -- Side Lunch Recipe
      IF v_rec.lunch_side_recipe_id IS NOT NULL THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.lunch_side_recipe_id
        LOOP
          v_qty := (v_ing.quantity_per_portion * v_rec.lunch_players);
          UPDATE public.ingredients 
          SET stock_actual = COALESCE(stock_actual, 0) - v_qty,
              stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty),
              updated_at = NOW()
          WHERE id = v_ing.ingredient_id;
          v_count := v_count + 1;
        END LOOP;
      END IF;
    END IF;

    UPDATE public.menu_planner SET lunch_processed = true, updated_at = NOW() WHERE id = v_rec.id;
    v_log := 'Descuento de Almuerzo ejecutado para fecha ' || p_date::text;

  ELSIF p_shift = 'dinner' THEN
    IF COALESCE(v_rec.dinner_players, 0) > 0 THEN
      IF v_rec.dinner_recipe_id IS NOT NULL THEN
        FOR v_ing IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = v_rec.dinner_recipe_id
        LOOP
          v_qty := (v_ing.quantity_per_portion * v_rec.dinner_players);
          UPDATE public.ingredients 
          SET stock_actual = COALESCE(stock_actual, 0) - v_qty,
              stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty),
              updated_at = NOW()
          WHERE id = v_ing.ingredient_id;
          v_count := v_count + 1;
        END LOOP;
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


-- 6. RPC: resetear_entorno_pruebas
-- Clears menu_planner and resets ingredients stock_actual & stock_reservado to 0
CREATE OR REPLACE FUNCTION resetear_entorno_pruebas()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ingredients 
  SET stock_actual = 0,
      stock_reservado = 0,
      updated_at = NOW();

  DELETE FROM public.menu_planner;

  RETURN jsonb_build_object('success', true, 'message', 'Entorno de pruebas reseteado correctamente.');
END;
$$;
