-- MIGRATION 011: Create guardar_y_confirmar_menu RPC function
DROP FUNCTION IF EXISTS guardar_y_confirmar_menu(jsonb);
CREATE OR REPLACE FUNCTION guardar_y_confirmar_menu(p_menu_days JSONB)
RETURNS TEXT AS $$
DECLARE
    v_item JSONB;
    v_recipe_id UUID;
    v_comensales INTEGER;
    v_date DATE;
    v_meal_type TEXT;
    v_plan_id UUID;
    v_confirmado BOOLEAN;
    v_ing record;
    v_log TEXT := '';
    v_ing_count INTEGER;
    v_total_gasto NUMERIC;
BEGIN
    v_log := v_log || '[INFO] Iniciando procesamiento en Supabase...' || CHR(10);
    
    -- Loop through each service item in the flat JSONB array
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_menu_days)
    LOOP
        v_recipe_id := (v_item->>'recipe_id')::UUID;
        v_comensales := COALESCE((v_item->>'num_players')::INTEGER, 0);
        v_date := (v_item->>'date')::DATE;
        v_meal_type := v_item->>'meal_type';

        v_log := v_log || '[PROCESANDO] Turno: ' || COALESCE(v_meal_type, 'null') || ' | Fecha: ' || COALESCE(v_date::TEXT, 'null') || ' | Receta ID: ' || COALESCE(v_recipe_id::TEXT, 'null') || ' | Comensales: ' || v_comensales || CHR(10);

        -- Skip if essential fields are missing
        IF v_recipe_id IS NULL OR v_date IS NULL THEN
            v_log := v_log || '[ALERTA SQL] Saltado por falta de campos clave (recipe_id o date nulos)' || CHR(10);
            CONTINUE;
        END IF;

        -- 1. Check if a record exists for this date in menu_planner
        SELECT id, confirmado INTO v_plan_id, v_confirmado 
        FROM menu_planner 
        WHERE date = v_date;

        -- 2. Update or Insert the menu_planner day record
        IF v_plan_id IS NOT NULL THEN
            v_log := v_log || '[SQL] Actualizando día existente ' || v_plan_id || CHR(10);
            IF v_meal_type = 'breakfast' THEN
                UPDATE menu_planner SET breakfast_recipe_id = v_recipe_id, breakfast_players = v_comensales, updated_at = NOW() WHERE id = v_plan_id;
            ELSIF v_meal_type = 'lunch' THEN
                UPDATE menu_planner SET lunch_recipe_id = v_recipe_id, lunch_players = v_comensales, updated_at = NOW() WHERE id = v_plan_id;
            ELSIF v_meal_type = 'dinner' THEN
                UPDATE menu_planner SET dinner_recipe_id = v_recipe_id, dinner_players = v_comensales, updated_at = NOW() WHERE id = v_plan_id;
            ELSIF v_meal_type = 'lunch_side' THEN
                UPDATE menu_planner SET lunch_side_recipe_id = v_recipe_id, updated_at = NOW() WHERE id = v_plan_id;
            END IF;
        ELSE
            v_log := v_log || '[SQL] Insertando nuevo día en menu_planner' || CHR(10);
            IF v_meal_type = 'breakfast' THEN
                INSERT INTO menu_planner (date, breakfast_recipe_id, breakfast_players, confirmado)
                VALUES (v_date, v_recipe_id, v_comensales, false) RETURNING id INTO v_plan_id;
            ELSIF v_meal_type = 'lunch' THEN
                INSERT INTO menu_planner (date, lunch_recipe_id, lunch_players, confirmado)
                VALUES (v_date, v_recipe_id, v_comensales, false) RETURNING id INTO v_plan_id;
            ELSIF v_meal_type = 'dinner' THEN
                INSERT INTO menu_planner (date, dinner_recipe_id, dinner_players, confirmado)
                VALUES (v_date, v_recipe_id, v_comensales, false) RETURNING id INTO v_plan_id;
            ELSIF v_meal_type = 'lunch_side' THEN
                INSERT INTO menu_planner (date, lunch_side_recipe_id, confirmado)
                VALUES (v_date, v_recipe_id, false) RETURNING id INTO v_plan_id;
            END IF;
        END IF;

        -- 3. Discount stock for the ingredients of this recipe (fuerza descuento siempre)
        v_ing_count := 0;
        IF v_comensales > 0 THEN
            FOR v_ing IN 
                SELECT ingredient_id, quantity_per_portion 
                FROM public.recipe_ingredients
                WHERE recipe_id = v_recipe_id
            LOOP
                v_ing_count := v_ing_count + 1;
                
                -- Calcular gasto
                v_total_gasto := (v_ing.quantity_per_portion * v_comensales);

                -- Descontar del stock real apuntando a stock_actual
                UPDATE public.ingredients
                SET stock_actual = stock_actual - v_total_gasto,
                    updated_at = NOW()
                WHERE id = v_ing.ingredient_id;
                
                -- Concatenar log para la Consola Visual
                v_log := v_log || '[DESCUENTO REAL] Ingrediente ID: ' || v_ing.ingredient_id || ' | Restados: ' || v_total_gasto || ' grs.' || CHR(10);
            END LOOP;
        END IF;

        IF v_ing_count = 0 THEN
            v_log := v_log || '[ALERTA SQL] No se encontraron filas para la receta ID: ' || v_recipe_id || CHR(10);
        END IF;

        -- 4. Mark this day as confirmed
        UPDATE menu_planner 
        SET 
            confirmado = true,
            updated_at = NOW()
        WHERE id = v_plan_id;
        
    END LOOP;
    
    RETURN v_log;
END;
$$ LANGUAGE plpgsql;
