-- MIGRATION 012: Add stock_reservado column to ingredients table
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS stock_reservado NUMERIC(12, 4) DEFAULT 0.0000;

COMMENT ON COLUMN public.ingredients.stock_reservado IS 'Cantidad de stock reservada para menús confirmados que aún no se han cocinado';

-- Function to confirm service completed and execute definitive stock movements
CREATE OR REPLACE FUNCTION completar_servicio_y_consumir_stock(p_date DATE, p_meal_type TEXT)
RETURNS VOID AS $$
DECLARE
    v_recipe_id UUID;
    v_comensales INTEGER;
    v_rec record;
    v_total_gasto NUMERIC;
BEGIN
    -- 1. Get the planned recipe and players for this specific meal type and date
    IF p_meal_type = 'breakfast' THEN
        SELECT breakfast_recipe_id, breakfast_players INTO v_recipe_id, v_comensales FROM menu_planner WHERE date = p_date;
    ELSIF p_meal_type = 'lunch' THEN
        SELECT lunch_recipe_id, lunch_players INTO v_recipe_id, v_comensales FROM menu_planner WHERE date = p_date;
    ELSIF p_meal_type = 'dinner' THEN
        SELECT dinner_recipe_id, dinner_players INTO v_recipe_id, v_comensales FROM menu_planner WHERE date = p_date;
    ELSIF p_meal_type = 'lunch_side' THEN
        -- Uses lunch players
        SELECT lunch_side_recipe_id, lunch_players INTO v_recipe_id, v_comensales FROM menu_planner WHERE date = p_date;
    END IF;

    IF v_recipe_id IS NULL OR v_comensales <= 0 THEN
        RETURN;
    END IF;

    -- 2. Deduct from both stock_actual and stock_reservado
    FOR v_rec IN (
        SELECT ingredient_id, quantity_per_portion 
        FROM public.recipe_ingredients
        WHERE recipe_id = v_recipe_id
    ) LOOP
        v_total_gasto := v_rec.quantity_per_portion * v_comensales;

        UPDATE public.ingredients
        SET 
            stock_actual = COALESCE(stock_actual, 0.0000) - v_total_gasto,
            stock_reservado = GREATEST(0.0000, COALESCE(stock_reservado, 0.0000) - v_total_gasto),
            updated_at = NOW()
        WHERE id = v_rec.ingredient_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
