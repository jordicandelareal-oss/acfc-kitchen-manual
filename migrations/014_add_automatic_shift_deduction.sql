-- MIGRATION 014: Sistema de Procesamiento de Turnos y Descuento Automático de Stock
-- Estructura Horaria Oficial de Servicios:
--   Desayuno (breakfast): 09:00 h
--   Comida / Almuerzo (lunch): 13:00 h
--   Cena (dinner): 19:00 h

-- 1. Añadir columnas de control de turnos procesados a menu_planner
ALTER TABLE menu_planner ADD COLUMN IF NOT EXISTS breakfast_processed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE menu_planner ADD COLUMN IF NOT EXISTS lunch_processed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE menu_planner ADD COLUMN IF NOT EXISTS dinner_processed BOOLEAN NOT NULL DEFAULT false;

-- 2. Función RPC para procesar turnos cuyo horario ya ha transcurrido
CREATE OR REPLACE FUNCTION procesar_descuentos_automaticos_turnos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamp := NOW();
  v_rec record;
  v_ing record;
  v_qty numeric;
  v_processed_count integer := 0;
  v_log text := '';
BEGIN
  v_log := v_log || '[CRON/AUTOMÁTICO] Ejecutando verificación de turnos transcurridos a ' || v_now::text || CHR(10);

  -- A. PROCESAR DESAYUNOS (Fecha + 09:00 h <= NOW() y breakfast_processed = false)
  FOR v_rec IN 
    SELECT mp.id, mp.date, mp.breakfast_recipe_id, COALESCE(mp.breakfast_players, 20) as players
    FROM menu_planner mp
    WHERE mp.breakfast_recipe_id IS NOT NULL 
      AND (mp.date + TIME '09:00:00') <= v_now
      AND mp.breakfast_processed = false
  LOOP
    FOR v_ing IN 
      SELECT ingredient_id, quantity_per_portion 
      FROM recipe_ingredients 
      WHERE recipe_id = v_rec.breakfast_recipe_id
    LOOP
      v_qty := (v_ing.quantity_per_portion * v_rec.players);
      UPDATE ingredients 
      SET stock_actual = COALESCE(stock_actual, 0) - v_qty,
          stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty),
          updated_at = NOW()
      WHERE id = v_ing.ingredient_id;
    END LOOP;

    UPDATE menu_planner SET breakfast_processed = true, updated_at = NOW() WHERE id = v_rec.id;
    v_processed_count := v_processed_count + 1;
    v_log := v_log || '[DESAYUNO COMPLETO] Día ' || v_rec.date || ' procesado a las 09:00h' || CHR(10);
  END LOOP;

  -- B. PROCESAR ALMUERZOS Y GUARNICIONES (Fecha + 13:00 h <= NOW() y lunch_processed = false)
  FOR v_rec IN 
    SELECT mp.id, mp.date, mp.lunch_recipe_id, mp.lunch_side_recipe_id, COALESCE(mp.lunch_players, 0) as players
    FROM menu_planner mp
    WHERE (mp.lunch_recipe_id IS NOT NULL OR mp.lunch_side_recipe_id IS NOT NULL)
      AND (mp.date + TIME '13:00:00') <= v_now
      AND mp.lunch_processed = false
  LOOP
    IF v_rec.players > 0 THEN
      -- Plato principal almuerzo
      IF v_rec.lunch_recipe_id IS NOT NULL THEN
        FOR v_ing IN 
          SELECT ingredient_id, quantity_per_portion 
          FROM recipe_ingredients 
          WHERE recipe_id = v_rec.lunch_recipe_id
        LOOP
          v_qty := (v_ing.quantity_per_portion * v_rec.players);
      UPDATE ingredients 
      SET stock_actual = COALESCE(stock_actual, 0) - v_qty,
          stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty),
          updated_at = NOW()
      WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;

      -- Guarnición almuerzo
      IF v_rec.lunch_side_recipe_id IS NOT NULL THEN
        FOR v_ing IN 
          SELECT ingredient_id, quantity_per_portion 
          FROM recipe_ingredients 
          WHERE recipe_id = v_rec.lunch_side_recipe_id
        LOOP
          v_qty := (v_ing.quantity_per_portion * v_rec.players);
      UPDATE ingredients 
      SET stock_actual = COALESCE(stock_actual, 0) - v_qty,
          stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty),
          updated_at = NOW()
      WHERE id = v_ing.ingredient_id;
        END LOOP;
      END IF;
    END IF;

    UPDATE menu_planner SET lunch_processed = true, updated_at = NOW() WHERE id = v_rec.id;
    v_processed_count := v_processed_count + 1;
    v_log := v_log || '[ALMUERZO COMPLETO] Día ' || v_rec.date || ' procesado a las 13:00h' || CHR(10);
  END LOOP;

  -- C. PROCESAR CENAS (Fecha + 19:00 h <= NOW() y dinner_processed = false)
  FOR v_rec IN 
    SELECT mp.id, mp.date, mp.dinner_recipe_id, COALESCE(mp.dinner_players, 0) as players
    FROM menu_planner mp
    WHERE mp.dinner_recipe_id IS NOT NULL 
      AND (mp.date + TIME '19:00:00') <= v_now
      AND mp.dinner_processed = false
  LOOP
    IF v_rec.players > 0 THEN
      FOR v_ing IN 
        SELECT ingredient_id, quantity_per_portion 
        FROM recipe_ingredients 
        WHERE recipe_id = v_rec.dinner_recipe_id
      LOOP
        v_qty := (v_ing.quantity_per_portion * v_rec.players);
        UPDATE ingredients 
        SET stock_actual = COALESCE(stock_actual, 0) - v_qty,
            stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - v_qty),
            updated_at = NOW()
        WHERE id = v_ing.ingredient_id;
      END LOOP;
    END IF;

    UPDATE menu_planner SET dinner_processed = true, updated_at = NOW() WHERE id = v_rec.id;
    v_processed_count := v_processed_count + 1;
    v_log := v_log || '[CENA COMPLETA] Día ' || v_rec.date || ' procesado a las 19:00h' || CHR(10);
  END LOOP;

  -- Marca el día como confirmado si los tres turnos fueron procesados o no aplican
  UPDATE menu_planner
  SET confirmado = true
  WHERE breakfast_processed = true 
    AND lunch_processed = true 
    AND dinner_processed = true;

  RETURN jsonb_build_object(
    'processed_count', v_processed_count,
    'log', v_log
  );
END;
$$;
