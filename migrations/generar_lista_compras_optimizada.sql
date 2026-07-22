-- Eliminar la función previa para poder redefinir el tipo de retorno
DROP FUNCTION IF EXISTS public.generar_lista_compras_optimizada();

-- Función RPC mejorada para cálculo de compras por insumo específico con corte (Sin duplicados)
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
BEGIN
  -- 1. Crear tabla temporal para necesidades brutas
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
    dest text
  ) ON COMMIT DROP;

  -- 2. Recolectar necesidades de Desayuno, Almuerzo, Guarnición y Cena
  -- Desayuno
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * COALESCE(mp.breakfast_players, 20),
    (r.name || ' (Desayuno)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.breakfast_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id;

  -- Almuerzo
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * mp.lunch_players,
    (r.name || ' (Almuerzo)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0;

  -- Guarnición
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * mp.lunch_players,
    (r.name || ' (Guarnición)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_side_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0;

  -- Cena
  INSERT INTO temp_needs (ing_id, ing_name, ing_unit, supp_name, supp_id, supp_phone, supp_email, is_cairo, corte, qty, dest)
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR s.name ILIKE '%samir%' OR s.contact_name ILIKE '%samir%'),
    COALESCE(ri.tipo_corte::text, 'Entera'::text),
    ri.quantity_per_portion * mp.dinner_players,
    (r.name || ' (Cena)')::text
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.dinner_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.dinner_players > 0;

  -- ── FLUJO A: CARNICERÍA EL CAIRO (CONSOLIDADO POR INSUMO Y CORTE ESPECÍFICO) ──
  FOR temp_row IN 
    SELECT 
      tn.ing_id, 
      tn.ing_name, 
      tn.supp_name, 
      tn.corte, 
      SUM(tn.qty) as total_qty, 
      string_agg(distinct tn.dest, ', ') as all_dests
    FROM temp_needs tn
    WHERE tn.is_cairo = true
    GROUP BY tn.ing_id, tn.ing_name, tn.supp_name, tn.corte
    ORDER BY tn.ing_name ASC
  LOOP
    fila_id := temp_row.ing_id;
    nombre_ingrediente := temp_row.ing_name::varchar;
    proveedor := 'Carnicería El Cairo'::varchar;
    corte := temp_row.corte::varchar;
    cantidad_necesaria := temp_row.total_qty::numeric;

    SELECT COALESCE(ingredients.stock_actual, 0) INTO db_stock FROM public.ingredients WHERE id = temp_row.ing_id;
    stock_actual := db_stock::numeric;
    a_comprar := GREATEST(0, cantidad_necesaria - db_stock)::numeric;
    destinations := temp_row.all_dests::text;

    RETURN NEXT;
  END LOOP;

  -- ── FLUJO B: RESTO DE PROVEEDORES (CONSOLIDADO GLOBAL POR INGREDIENTE) ──
  FOR temp_row IN 
    SELECT 
      tn.ing_id, 
      tn.ing_name, 
      tn.supp_name, 
      SUM(tn.qty) as total_qty, 
      string_agg(distinct tn.dest, ', ') as all_dests
    FROM temp_needs tn
    WHERE tn.is_cairo = false
    GROUP BY tn.ing_id, tn.ing_name, tn.supp_name
    ORDER BY tn.ing_name ASC
  LOOP
    fila_id := temp_row.ing_id;
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
