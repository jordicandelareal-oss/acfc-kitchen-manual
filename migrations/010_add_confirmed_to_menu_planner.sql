-- MIGRATION 010: Add confirmado column to menu_planner table and create stock deduction function
ALTER TABLE menu_planner ADD COLUMN IF NOT EXISTS confirmado BOOLEAN NOT NULL DEFAULT false;

-- Create function to confirm and discount stock atomics
CREATE OR REPLACE FUNCTION confirmar_y_descontar_stock(plan_id UUID)
RETURNS void AS $$
DECLARE
    v_confirmado BOOLEAN;
    v_rec record;
BEGIN
    -- 1. Check if the menu is already confirmed
    SELECT confirmado INTO v_confirmado FROM menu_planner WHERE id = plan_id;
    
    -- If the plan doesn't exist, throw exception
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El planificador con ID % no existe.', plan_id;
    END IF;
    
    IF v_confirmado IS TRUE THEN
        RAISE EXCEPTION 'El menú ya ha sido confirmado y el stock ya fue descontado.';
    END IF;

    -- 2. Loop through all recipes and calculate ingredient deduction
    FOR v_rec IN (
        -- Breakfast
        SELECT 
            m.breakfast_recipe_id AS recipe_id, 
            COALESCE(m.breakfast_players, 0) AS servings,
            ri.ingredient_id,
            ri.quantity_per_portion
        FROM menu_planner m
        JOIN recipe_ingredients ri ON ri.recipe_id = m.breakfast_recipe_id
        WHERE m.id = plan_id AND m.breakfast_recipe_id IS NOT NULL
        
        UNION ALL
        
        -- Lunch
        SELECT 
            m.lunch_recipe_id AS recipe_id, 
            COALESCE(m.lunch_players, 0) AS servings,
            ri.ingredient_id,
            ri.quantity_per_portion
        FROM menu_planner m
        JOIN recipe_ingredients ri ON ri.recipe_id = m.lunch_recipe_id
        WHERE m.id = plan_id AND m.lunch_recipe_id IS NOT NULL
        
        UNION ALL
        
        -- Dinner
        SELECT 
            m.dinner_recipe_id AS recipe_id, 
            COALESCE(m.dinner_players, 0) AS servings,
            ri.ingredient_id,
            ri.quantity_per_portion
        FROM menu_planner m
        JOIN recipe_ingredients ri ON ri.recipe_id = m.dinner_recipe_id
        WHERE m.id = plan_id AND m.dinner_recipe_id IS NOT NULL

        UNION ALL
        
        -- Lunch Side (uses lunch players)
        SELECT 
            m.lunch_side_recipe_id AS recipe_id, 
            COALESCE(m.lunch_players, 0) AS servings,
            ri.ingredient_id,
            ri.quantity_per_portion
        FROM menu_planner m
        JOIN recipe_ingredients ri ON ri.recipe_id = m.lunch_side_recipe_id
        WHERE m.id = plan_id AND m.lunch_side_recipe_id IS NOT NULL
    ) LOOP
        -- Update the ingredients stock
        UPDATE ingredients 
        SET 
            current_stock = current_stock - (v_rec.quantity_per_portion * v_rec.servings),
            stock_actual = COALESCE(stock_actual, 0.0000) - (v_rec.quantity_per_portion * v_rec.servings),
            updated_at = NOW()
        WHERE id = v_rec.ingredient_id;
    END LOOP;

    -- 3. Mark the menu as confirmed
    UPDATE menu_planner 
    SET 
        confirmado = true,
        updated_at = NOW()
    WHERE id = plan_id;

END;
$$ LANGUAGE plpgsql;
