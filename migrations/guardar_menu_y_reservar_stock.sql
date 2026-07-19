-- Función RPC para guardar menú y reservar stock transaccionalmente
CREATE OR REPLACE FUNCTION public.guardar_menu_y_reservar_stock(p_menu_days jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_record jsonb;
  recipe_id_var uuid;
  players_var integer;
  ri_record record;
  needed_qty numeric;
BEGIN
  -- 1. Iterar sobre la lista de días enviados en el payload
  FOR day_record IN SELECT * FROM jsonb_array_elements(p_menu_days)
  LOOP
    -- A. Realizar UPSERT en la tabla menu_planner
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
      dinner_allergies
    )
    VALUES (
      (day_record->>'date')::date,
      (day_record->>'breakfast_recipe_id')::uuid,
      (day_record->>'lunch_recipe_id')::uuid,
      (day_record->>'lunch_side_recipe_id')::uuid,
      (day_record->>'dinner_recipe_id')::uuid,
      COALESCE((day_record->>'lunch_players')::integer, 0),
      COALESCE((day_record->>'lunch_halal')::integer, 0),
      COALESCE((day_record->>'lunch_kosher')::integer, 0),
      COALESCE((day_record->>'lunch_vegan')::integer, 0),
      COALESCE(day_record->>'lunch_allergies', ''),
      COALESCE((day_record->>'dinner_players')::integer, 0),
      COALESCE((day_record->>'dinner_halal')::integer, 0),
      COALESCE((day_record->>'dinner_kosher')::integer, 0),
      COALESCE((day_record->>'dinner_vegan')::integer, 0),
      COALESCE(day_record->>'dinner_allergies', '')
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
      dinner_allergies = EXCLUDED.dinner_allergies;

    -- B. Reservar stock para el Desayuno (si tiene receta)
    recipe_id_var := (day_record->>'breakfast_recipe_id')::uuid;
    IF recipe_id_var IS NOT NULL THEN
      FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
      LOOP
        needed_qty := ri_record.quantity_per_portion * 20; -- Desayuno fijo de 20 pax en la configuración
        UPDATE public.ingredients 
        SET stock_reservado = COALESCE(stock_reservado, 0) + needed_qty 
        WHERE id = ri_record.ingredient_id;
        
        RAISE NOTICE '[AUDITORÍA] Reserva Desayuno: Ingrediente % | Cantidad %', ri_record.ingredient_id, needed_qty;
      END LOOP;
    END IF;

    -- C. Reservar stock para el Almuerzo (Plato Principal)
    recipe_id_var := (day_record->>'lunch_recipe_id')::uuid;
    players_var := COALESCE((day_record->>'lunch_players')::integer, 0);
    IF recipe_id_var IS NOT NULL AND players_var > 0 THEN
      FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
      LOOP
        needed_qty := ri_record.quantity_per_portion * players_var;
        UPDATE public.ingredients 
        SET stock_reservado = COALESCE(stock_reservado, 0) + needed_qty 
        WHERE id = ri_record.ingredient_id;
        
        RAISE NOTICE '[AUDITORÍA] Reserva Almuerzo: Ingrediente % | Cantidad %', ri_record.ingredient_id, needed_qty;
      END LOOP;
    END IF;

    -- D. Reservar stock para el Acompañamiento / Guarnición
    recipe_id_var := (day_record->>'lunch_side_recipe_id')::uuid;
    players_var := COALESCE((day_record->>'lunch_players')::integer, 0);
    IF recipe_id_var IS NOT NULL AND players_var > 0 THEN
      FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
      LOOP
        needed_qty := ri_record.quantity_per_portion * players_var;
        UPDATE public.ingredients 
        SET stock_reservado = COALESCE(stock_reservado, 0) + needed_qty 
        WHERE id = ri_record.ingredient_id;
        
        RAISE NOTICE '[AUDITORÍA] Reserva Acompañamiento: Ingrediente % | Cantidad %', ri_record.ingredient_id, needed_qty;
      END LOOP;
    END IF;

    -- E. Reservar stock para la Cena
    recipe_id_var := (day_record->>'dinner_recipe_id')::uuid;
    players_var := COALESCE((day_record->>'dinner_players')::integer, 0);
    IF recipe_id_var IS NOT NULL AND players_var > 0 THEN
      FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
      LOOP
        needed_qty := ri_record.quantity_per_portion * players_var;
        UPDATE public.ingredients 
        SET stock_reservado = COALESCE(stock_reservado, 0) + needed_qty 
        WHERE id = ri_record.ingredient_id;
        
        RAISE NOTICE '[AUDITORÍA] Reserva Cena: Ingrediente % | Cantidad %', ri_record.ingredient_id, needed_qty;
      END LOOP;
    END IF;

  END LOOP;
END;
$$;
