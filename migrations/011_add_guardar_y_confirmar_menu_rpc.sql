-- MIGRATION 011: Create guardar_y_confirmar_menu RPC function
CREATE OR REPLACE FUNCTION guardar_y_confirmar_menu(p_menu_days JSONB)
RETURNS VOID AS $$
DECLARE
    v_item JSONB;
    v_recipe_id UUID;
    v_comensales INTEGER;
    v_date DATE;
    v_meal_type TEXT;
    v_plan_id UUID;
    v_confirmado BOOLEAN;
    v_rec record;
    v_confirmed_dates DATE[] := '{}';
BEGIN
    -- Loop through each service item in the flat JSONB array
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_menu_days)
    LOOP
        v_recipe_id := (v_item->>'recipe_id')::UUID;
        v_comensales := COALESCE((v_item->>'num_players')::INTEGER, 0);
        v_date := (v_item->>'date')::DATE;
        v_meal_type := v_item->>'meal_type';

        -- Skip if essential fields are missing
        IF v_recipe_id IS NULL OR v_date IS NULL THEN
            CONTINUE;
        END IF;

        -- 1. Check if a record exists for this date in menu_planner
        SELECT id, confirmado INTO v_plan_id, v_confirmado 
        FROM menu_planner 
        WHERE date = v_date;
        
        -- 2. If it was confirmed BEFORE this function call (i.e. confirmed in DB but NOT in our array), we skip to avoid double discounting
        IF v_confirmado IS TRUE AND NOT (v_date = ANY(v_confirmed_dates)) THEN
            CONTINUE;
        END IF;

        -- 3. Update or Insert the menu_planner day record
        IF v_plan_id IS NOT NULL THEN
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

        -- 4. Discount stock for the ingredients of this recipe using real column names
        IF v_comensales > 0 THEN
            FOR v_rec IN (
                SELECT ri.ingredient_id, ri.quantity_per_portion
                FROM recipe_ingredients ri
                WHERE ri.recipe_id = v_recipe_id
            ) LOOP
                -- Deduct from stock_actual (verified database column)
                UPDATE ingredients 
                SET 
                    stock_actual = COALESCE(stock_actual, 0.0000) - (v_rec.quantity_per_portion * v_comensales),
                    updated_at = NOW()
                WHERE id = v_rec.ingredient_id;
            END LOOP;
        END IF;

        -- 5. Mark this day as confirmed and add it to our list of confirmed dates in this transaction
        UPDATE menu_planner 
        SET 
            confirmado = true,
            updated_at = NOW()
        WHERE id = v_plan_id;

        IF NOT (v_date = ANY(v_confirmed_dates)) THEN
            v_confirmed_dates := array_append(v_confirmed_dates, v_date);
        END IF;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;
