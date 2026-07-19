-- Función RPC mejorada para guardar menú liberando previamente el stock antiguo del día para consistencia total
CREATE OR REPLACE FUNCTION public.guardar_menu_y_reservar_stock(p_menu_days jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_record jsonb;
  target_date date;
  planner_record record;
  recipe_id_var uuid;
  players_var integer;
  ri_record record;
  needed_qty numeric;
BEGIN
  -- 1. Iterar sobre la lista de días enviados en el payload
  FOR day_record IN SELECT * FROM jsonb_array_elements(p_menu_days)
  LOOP
    target_date := (day_record->>'date')::date;

    -- A. Liberar stock de la planificación antigua del día (si existe) para evitar duplicaciones
    SELECT * INTO planner_record FROM public.menu_planner WHERE date = target_date;
    
    IF FOUND THEN
      -- Desayuno previo
      recipe_id_var := planner_record.breakfast_recipe_id;
      IF recipe_id_var IS NOT NULL THEN
        FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
        LOOP
          UPDATE public.ingredients 
          SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - (ri_record.quantity_per_portion * 20)) 
          WHERE id = ri_record.ingredient_id;
        END LOOP;
      END IF;

      -- Almuerzo previo
      recipe_id_var := planner_record.lunch_recipe_id;
      players_var := COALESCE(planner_record.lunch_players, 0);
      IF recipe_id_var IS NOT NULL AND players_var > 0 THEN
        FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
        LOOP
          UPDATE public.ingredients 
          SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - (ri_record.quantity_per_portion * players_var)) 
          WHERE id = ri_record.ingredient_id;
        END LOOP;
      END IF;

      -- Guarnición previa
      recipe_id_var := planner_record.lunch_side_recipe_id;
      players_var := COALESCE(planner_record.lunch_players, 0);
      IF recipe_id_var IS NOT NULL AND players_var > 0 THEN
        FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
        LOOP
          UPDATE public.ingredients 
          SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - (ri_record.quantity_per_portion * players_var)) 
          WHERE id = ri_record.ingredient_id;
        END LOOP;
      END IF;

      -- Cena previa
      recipe_id_var := planner_record.dinner_recipe_id;
      players_var := COALESCE(planner_record.dinner_players, 0);
      IF recipe_id_var IS NOT NULL AND players_var > 0 THEN
        FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
        LOOP
          UPDATE public.ingredients 
          SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - (ri_record.quantity_per_portion * players_var)) 
          WHERE id = ri_record.ingredient_id;
        END LOOP;
      END IF;
    END IF;

    -- B. Realizar UPSERT en la tabla menu_planner con la nueva información del día
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
      target_date,
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

    -- C. Reservar stock para el Desayuno (nueva receta)
    recipe_id_var := (day_record->>'breakfast_recipe_id')::uuid;
    IF recipe_id_var IS NOT NULL THEN
      FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
      LOOP
        needed_qty := ri_record.quantity_per_portion * 20; -- Desayuno fijo de 20 pax
        UPDATE public.ingredients 
        SET stock_reservado = COALESCE(stock_reservado, 0) + needed_qty 
        WHERE id = ri_record.ingredient_id;
        
        RAISE NOTICE '[AUDITORÍA] Reserva Desayuno: Ingrediente % | Cantidad %', ri_record.ingredient_id, needed_qty;
      END LOOP;
    END IF;

    -- D. Reservar stock para el Almuerzo (nueva receta)
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

    -- E. Reservar stock para el Acompañamiento / Guarnición (nueva receta)
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

    -- F. Reservar stock para la Cena (nueva receta)
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
