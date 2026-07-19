-- Función RPC para eliminar menús de planificación y liberar stock transaccionalmente
CREATE OR REPLACE FUNCTION public.eliminar_menu_y_liberar_stock(p_dates date[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_date date;
  planner_record record;
  recipe_id_var uuid;
  players_var integer;
  ri_record record;
  reserved_qty numeric;
BEGIN
  -- 1. Iterar sobre el array de fechas recibidas
  FOREACH target_date IN ARRAY p_dates
  LOOP
    -- A. Obtener el registro de planificación actual
    SELECT * INTO planner_record FROM public.menu_planner WHERE date = target_date;
    
    IF FOUND THEN
      -- B. Liberar stock del Desayuno
      recipe_id_var := planner_record.breakfast_recipe_id;
      IF recipe_id_var IS NOT NULL THEN
        FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
        LOOP
          reserved_qty := ri_record.quantity_per_portion * 20; -- Desayuno fijo de 20 pax
          UPDATE public.ingredients 
          SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - reserved_qty) 
          WHERE id = ri_record.ingredient_id;
          
          RAISE NOTICE '[LOG] Stock liberado para ingrediente %: cantidad %', ri_record.ingredient_id, reserved_qty;
        END LOOP;
      END IF;

      -- C. Liberar stock del Almuerzo (Plato Principal)
      recipe_id_var := planner_record.lunch_recipe_id;
      players_var := COALESCE(planner_record.lunch_players, 0);
      IF recipe_id_var IS NOT NULL AND players_var > 0 THEN
        FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
        LOOP
          reserved_qty := ri_record.quantity_per_portion * players_var;
          UPDATE public.ingredients 
          SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - reserved_qty) 
          WHERE id = ri_record.ingredient_id;
          
          RAISE NOTICE '[LOG] Stock liberado para ingrediente %: cantidad %', ri_record.ingredient_id, reserved_qty;
        END LOOP;
      END IF;

      -- D. Liberar stock del Acompañamiento / Guarnición
      recipe_id_var := planner_record.lunch_side_recipe_id;
      players_var := COALESCE(planner_record.lunch_players, 0);
      IF recipe_id_var IS NOT NULL AND players_var > 0 THEN
        FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
        LOOP
          reserved_qty := ri_record.quantity_per_portion * players_var;
          UPDATE public.ingredients 
          SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - reserved_qty) 
          WHERE id = ri_record.ingredient_id;
          
          RAISE NOTICE '[LOG] Stock liberado para ingrediente %: cantidad %', ri_record.ingredient_id, reserved_qty;
        END LOOP;
      END IF;

      -- E. Liberar stock de la Cena
      recipe_id_var := planner_record.dinner_recipe_id;
      players_var := COALESCE(planner_record.dinner_players, 0);
      IF recipe_id_var IS NOT NULL AND players_var > 0 THEN
        FOR ri_record IN SELECT ingredient_id, quantity_per_portion FROM public.recipe_ingredients WHERE recipe_id = recipe_id_var
        LOOP
          reserved_qty := ri_record.quantity_per_portion * players_var;
          UPDATE public.ingredients 
          SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - reserved_qty) 
          WHERE id = ri_record.ingredient_id;
          
          RAISE NOTICE '[LOG] Stock liberado para ingrediente %: cantidad %', ri_record.ingredient_id, reserved_qty;
        END LOOP;
      END IF;

      -- F. Eliminar el registro en menu_planner
      DELETE FROM public.menu_planner WHERE date = target_date;
      
    END IF;
  END LOOP;
END;
$$;
