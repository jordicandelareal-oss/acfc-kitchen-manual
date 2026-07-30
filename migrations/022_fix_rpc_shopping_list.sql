-- Fixes NULL player counts and explicitly filters confirmed menus for the RPC function

CREATE OR REPLACE FUNCTION public.generar_lista_compras_optimizada()
RETURNS TABLE (
  fila_id uuid,
  nombre_ingrediente varchar,
  proveedor varchar,
  corte varchar,
  cantidad_necesaria numeric,
  a_comprar numeric,
  stock_actual numeric,
  destinations text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_veg_count int;
  temp_row record;
BEGIN
  -- 1. Determinar número de comensales vegetarianos activos
  SELECT count(*) INTO v_veg_count
  FROM public.comensales
  WHERE activo = true AND (dieta ILIKE '%vegetarian%' OR dieta ILIKE '%vegan%');

  -- Si es nulo por alguna razón, usar 0
  v_veg_count := COALESCE(v_veg_count, 0);

  -- 2. Crear tabla temporal para acumular necesidades brutas del menú (filtrando por confirmado = true)
  CREATE TEMP TABLE temp_needs (
    ing_id uuid,
    ing_name varchar,
    ing_unit varchar,
    supp_name varchar,
    supp_id uuid,
    supp_phone varchar,
    supp_email varchar,
    is_cairo boolean,
    corte varchar,
    qty numeric,
    dest text
  ) ON COMMIT DROP;

  -- ================== DESAYUNO ==================
  -- Estándar
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * GREATEST(0, COALESCE(mp.breakfast_players, 20) - v_veg_count),
    (r.name || ' (Desayuno Estándar)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.breakfast_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.confirmado = true AND GREATEST(0, COALESCE(mp.breakfast_players, 20) - v_veg_count) > 0;

  -- Vegetariano
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * LEAST(COALESCE(mp.breakfast_players, 20), v_veg_count),
    (r.name || ' (Desayuno Veg)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = public.get_vegetarian_alternative(mp.breakfast_recipe_id)
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.confirmado = true AND LEAST(COALESCE(mp.breakfast_players, 20), v_veg_count) > 0;

  -- ================== ALMUERZO ==================
  -- Estándar
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * GREATEST(0, COALESCE(mp.lunch_players, 20) - v_veg_count),
    (r.name || ' (Almuerzo Estándar)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.confirmado = true AND GREATEST(0, COALESCE(mp.lunch_players, 20) - v_veg_count) > 0;

  -- Vegetariano
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * LEAST(COALESCE(mp.lunch_players, 20), v_veg_count),
    (r.name || ' (Almuerzo Veg)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = public.get_vegetarian_alternative(mp.lunch_recipe_id)
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.confirmado = true AND LEAST(COALESCE(mp.lunch_players, 20), v_veg_count) > 0;

  -- ================== GUARNICIÓN ==================
  -- Estándar
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * GREATEST(0, COALESCE(mp.lunch_players, 20) - v_veg_count),
    (r.name || ' (Guarnición Estándar)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_side_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.confirmado = true AND GREATEST(0, COALESCE(mp.lunch_players, 20) - v_veg_count) > 0;

  -- Vegetariano
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * LEAST(COALESCE(mp.lunch_players, 20), v_veg_count),
    (r.name || ' (Guarnición Veg)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = public.get_vegetarian_alternative(mp.lunch_side_recipe_id)
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.confirmado = true AND LEAST(COALESCE(mp.lunch_players, 20), v_veg_count) > 0;

  -- ================== CENA ==================
  -- Estándar
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * GREATEST(0, COALESCE(mp.dinner_players, 20) - v_veg_count),
    (r.name || ' (Cena Estándar)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.dinner_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.confirmado = true AND GREATEST(0, COALESCE(mp.dinner_players, 20) - v_veg_count) > 0;

  -- Vegetariano
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * LEAST(COALESCE(mp.dinner_players, 20), v_veg_count),
    (r.name || ' (Cena Veg)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = public.get_vegetarian_alternative(mp.dinner_recipe_id)
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.confirmado = true AND LEAST(COALESCE(mp.dinner_players, 20), v_veg_count) > 0;

  -- 3. Consolidar, calcular a_comprar contra stock y retornar
  FOR temp_row IN
    SELECT 
      t.ing_id, 
      t.ing_name, 
      t.supp_name, 
      t.corte, 
      SUM(t.qty) AS total_qty, 
      STRING_AGG(DISTINCT t.dest, ', ') AS destinations
    FROM temp_needs t
    GROUP BY t.ing_id, t.ing_name, t.supp_name, t.corte
  LOOP
    fila_id := gen_random_uuid();
    nombre_ingrediente := temp_row.ing_name;
    proveedor := temp_row.supp_name;
    corte := temp_row.corte;
    cantidad_necesaria := temp_row.total_qty;
    destinations := temp_row.destinations;

    -- Extraer stock actual desde public.ingredients
    SELECT COALESCE(stock_actual, 0) INTO stock_actual 
    FROM public.ingredients 
    WHERE id = temp_row.ing_id;

    -- Calcular cantidad a comprar: max(0, necesidad - stock)
    a_comprar := GREATEST(0, cantidad_necesaria - stock_actual);

    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;
