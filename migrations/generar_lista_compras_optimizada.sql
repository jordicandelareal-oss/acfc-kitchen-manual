-- Eliminar la función previa para poder redefinir el tipo de retorno
DROP FUNCTION IF EXISTS public.generar_lista_compras_optimizada();

-- Función RPC mejorada para cálculo de compras del lado del servidor sin agrupaciones para El Cairo
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
  temp_row record;
  db_stock numeric;
  stock_restante numeric;
  needed numeric;
  descontado numeric;
  cairo_stock_map jsonb := '{}'::jsonb; -- Mapa en memoria para seguir el stock disponible por ingrediente
  current_cairo_stock numeric;
BEGIN
  -- 1. Crear una tabla temporal para consolidar las necesidades brutas
  CREATE TEMP TABLE temp_needs (
    id uuid DEFAULT gen_random_uuid(),
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
    dest text,
    meal_label text,
    plan_date date,
    shift_order int
  ) ON COMMIT DROP;

  -- 2. Recolectar necesidades de Desayuno, Almuerzo, Guarnición y Cena planificadas
  -- Desayuno (shift_order = 1)
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest, meal_label, plan_date, shift_order)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * COALESCE(mp.breakfast_players, 20),
    (r.name || ' (Desayuno)')::text,
    'Desayuno'::text,
    mp.date,
    1
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.breakfast_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id;

  -- Almuerzo (shift_order = 2)
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest, meal_label, plan_date, shift_order)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * mp.lunch_players,
    (r.name || ' (Almuerzo)')::text,
    'Almuerzo'::text,
    mp.date,
    2
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0;

  -- Guarnición (shift_order = 3)
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest, meal_label, plan_date, shift_order)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * mp.lunch_players,
    (r.name || ' (Guarnición)')::text,
    'Guarnición'::text,
    mp.date,
    3
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_side_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0;

  -- Cena (shift_order = 4)
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest, meal_label, plan_date, shift_order)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * mp.dinner_players,
    (r.name || ' (Cena)')::text,
    'Cena'::text,
    mp.date,
    4
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.dinner_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.dinner_players > 0;

  -- ── FLUJO A: CARNICERÍA EL CAIRO (BANDEJAS INDEPENDIENTES EN ORDEN CRONOLÓGICO) ──
  FOR temp_row IN 
    SELECT tn.id, tn.ing_id, tn.ing_name, tn.supp_name, tn.corte, tn.qty, tn.dest
    FROM temp_needs tn
    WHERE tn.is_cairo = true
    ORDER BY tn.plan_date ASC, tn.shift_order ASC, tn.id ASC
  LOOP
    fila_id := temp_row.id;
    nombre_ingrediente := temp_row.ing_name::varchar;
    proveedor := 'Carnicería El Cairo'::varchar;
    corte := temp_row.corte::varchar;
    cantidad_necesaria := temp_row.qty::numeric;

    -- Obtener o inicializar el stock en el mapa en memoria (evaluando la columna stock_actual)
    IF NOT cairo_stock_map ? temp_row.ing_id::text THEN
      SELECT COALESCE(ingredients.stock_actual, 0) INTO db_stock FROM public.ingredients WHERE id = temp_row.ing_id;
      cairo_stock_map := cairo_stock_map || jsonb_build_object(temp_row.ing_id::text, db_stock);
    END IF;

    current_cairo_stock := (cairo_stock_map->>temp_row.ing_id::text)::numeric;
    descontado := LEAST(cantidad_necesaria, current_cairo_stock);
    current_cairo_stock := current_cairo_stock - descontado;
    
    -- Actualizar mapa con el stock restante
    cairo_stock_map := cairo_stock_map || jsonb_build_object(temp_row.ing_id::text, current_cairo_stock);

    -- El stock de base de datos se expone de forma directa para el reporte
    SELECT COALESCE(ingredients.stock_actual, 0) INTO stock_actual FROM public.ingredients WHERE id = temp_row.ing_id;

    a_comprar := GREATEST(0, cantidad_necesaria - descontado)::numeric;
    destinations := temp_row.dest::text;

    RETURN NEXT;
  END LOOP;

  -- ── FLUJO B: RESTO DE PROVEEDORES (CONSOLIDADO POR INGREDIENTE MEDIANTE GROUP BY) ──
  FOR temp_row IN 
    SELECT MIN(tn.id::text)::uuid as first_id, tn.ing_id, tn.ing_name, tn.supp_name, SUM(tn.qty) as total_qty, string_agg(distinct tn.dest, ', ') as all_dests
    FROM temp_needs tn
    WHERE tn.is_cairo = false
    GROUP BY tn.ing_id, tn.ing_name, tn.supp_name
  LOOP
    fila_id := temp_row.first_id;
    nombre_ingrediente := temp_row.ing_name::varchar;
    proveedor := COALESCE(temp_row.supp_name, 'Sin proveedor asignado')::varchar;
    corte := ''::varchar;
    cantidad_necesaria := temp_row.total_qty::numeric;

    SELECT COALESCE(ingredients.stock_actual, 0) INTO db_stock FROM public.ingredients WHERE id = temp_row.ing_id;
    stock_actual := db_stock::numeric;
    a_comprar := GREATEST(0, cantidad_necesaria - db_stock)::numeric;
    destinations := temp_row.all_dests::text;

    RETURN NEXT;
  END LOOP;
END;
$$;

