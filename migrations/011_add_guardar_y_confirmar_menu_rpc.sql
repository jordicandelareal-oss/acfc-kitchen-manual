-- MIGRATION 011: Create guardar_y_confirmar_menu RPC function
CREATE OR REPLACE FUNCTION guardar_y_confirmar_menu(p_menu_days JSONB)
RETURNS VOID AS $$
DECLARE
    v_day JSONB;
    v_date DATE;
    v_breakfast_recipe_id UUID;
    v_breakfast_players INTEGER;
    v_lunch_recipe_id UUID;
    v_lunch_players INTEGER;
    v_dinner_recipe_id UUID;
    v_dinner_players INTEGER;
    v_lunch_side_recipe_id UUID;
    v_confirmado BOOLEAN;
    v_rec record;
    v_plan_id UUID;
BEGIN
    -- Loop through each day object in the JSONB array
    FOR v_day IN SELECT * FROM jsonb_array_elements(p_menu_days)
    LOOP
        v_date := (v_day->>'date')::DATE;
        v_breakfast_recipe_id := (v_day->>'breakfast_recipe_id')::UUID;
        v_breakfast_players := COALESCE((v_day->>'breakfast_players')::INTEGER, 0);
        v_lunch_recipe_id := (v_day->>'lunch_recipe_id')::UUID;
        v_lunch_players := COALESCE((v_day->>'lunch_players')::INTEGER, 0);
        v_dinner_recipe_id := (v_day->>'dinner_recipe_id')::UUID;
        v_dinner_players := COALESCE((v_day->>'dinner_players')::INTEGER, 0);
        v_lunch_side_recipe_id := (v_day->>'lunch_side_recipe_id')::UUID;

        -- Check if a record already exists for this date and check if it is already confirmed
        SELECT id, confirmado INTO v_plan_id, v_confirmado 
        FROM menu_planner 
        WHERE date = v_date;
        
        IF v_plan_id IS NOT NULL THEN
            IF v_confirmado IS TRUE THEN
                CONTINUE; -- Already confirmed and stock discounted, do nothing for this day
            END IF;

            -- Update existing record
            UPDATE menu_planner
            SET
                breakfast_recipe_id = v_breakfast_recipe_id,
                breakfast_players = v_breakfast_players,
                lunch_recipe_id = v_lunch_recipe_id,
                lunch_players = v_lunch_players,
                dinner_recipe_id = v_dinner_recipe_id,
                dinner_players = v_dinner_players,
                lunch_side_recipe_id = v_lunch_side_recipe_id,
                updated_at = NOW()
            WHERE id = v_plan_id;
        ELSE
            -- Insert new record
            INSERT INTO menu_planner (
                date,
                breakfast_recipe_id,
                breakfast_players,
                lunch_recipe_id,
                lunch_players,
                dinner_recipe_id,
                dinner_players,
                lunch_side_recipe_id,
                confirmado
            ) VALUES (
                v_date,
                v_breakfast_recipe_id,
                v_breakfast_players,
                v_lunch_recipe_id,
                v_lunch_players,
                v_dinner_recipe_id,
                v_dinner_players,
                v_lunch_side_recipe_id,
                false
            ) RETURNING id INTO v_plan_id;
        END IF;

        -- Discount stock for this day (since it wasn't already confirmed)
        FOR v_rec IN (
            -- Breakfast
            SELECT 
                v_breakfast_recipe_id AS recipe_id, 
                v_breakfast_players AS servings,
                ri.ingredient_id,
                ri.quantity_per_portion
            FROM recipe_ingredients ri 
            WHERE ri.recipe_id = v_breakfast_recipe_id
            
            UNION ALL
            
            -- Lunch
            SELECT 
                v_lunch_recipe_id AS recipe_id, 
                v_lunch_players AS servings,
                ri.ingredient_id,
                ri.quantity_per_portion
            FROM recipe_ingredients ri 
            WHERE ri.recipe_id = v_lunch_recipe_id
            
            UNION ALL
            
            -- Dinner
            SELECT 
                v_dinner_recipe_id AS recipe_id, 
                v_dinner_players AS servings,
                ri.ingredient_id,
                ri.quantity_per_portion
            FROM recipe_ingredients ri 
            WHERE ri.recipe_id = v_dinner_recipe_id

            UNION ALL
            
            -- Lunch Side (uses lunch players)
            SELECT 
                v_lunch_side_recipe_id AS recipe_id, 
                v_lunch_players AS servings,
                ri.ingredient_id,
                ri.quantity_per_portion
            FROM recipe_ingredients ri 
            WHERE ri.recipe_id = v_lunch_side_recipe_id
        ) LOOP
            -- Update the ingredients stock
            UPDATE ingredients 
            SET 
                stock_actual = COALESCE(stock_actual, 0.0000) - (v_rec.quantity_per_portion * v_rec.servings),
                updated_at = NOW()
            WHERE id = v_rec.ingredient_id;
        END LOOP;

        -- Mark this day as confirmed
        UPDATE menu_planner 
        SET 
            confirmado = true,
            updated_at = NOW()
        WHERE id = v_plan_id;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;
