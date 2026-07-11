-- MIGRATION 013: RPC to release reserved stock when a planner meal slot is cleared
-- Call this BEFORE nulling the recipe_id in menu_planner, passing the old recipe_id and players count
DROP FUNCTION IF EXISTS liberar_stock_reservado(UUID, INTEGER);
CREATE OR REPLACE FUNCTION liberar_stock_reservado(p_recipe_id UUID, p_comensales INTEGER)
RETURNS VOID AS $$
DECLARE
    v_rec record;
    v_total_gasto NUMERIC;
BEGIN
    IF p_recipe_id IS NULL OR p_comensales <= 0 THEN
        RETURN;
    END IF;

    FOR v_rec IN (
        SELECT ingredient_id, quantity_per_portion 
        FROM public.recipe_ingredients
        WHERE recipe_id = p_recipe_id
    ) LOOP
        v_total_gasto := v_rec.quantity_per_portion * p_comensales;

        -- Reduce stock_reservado, flooring at 0 to prevent negative reservations
        UPDATE public.ingredients
        SET stock_reservado = GREATEST(0.0000, COALESCE(stock_reservado, 0.0000) - v_total_gasto),
            updated_at = NOW()
        WHERE id = v_rec.ingredient_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
