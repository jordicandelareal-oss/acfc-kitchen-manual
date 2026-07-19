-- Función RPC para calcular la lista de compras desde la base de datos
CREATE OR REPLACE FUNCTION public.generar_lista_compras_optimizada()
RETURNS TABLE (
  ingredient_id uuid,
  ingredient_name varchar,
  unit varchar,
  supplier_name varchar,
  supplier_id uuid,
  supplier_phone varchar,
  supplier_email varchar,
  is_el_cairo boolean,
  tipo_corte varchar,
  quantity_required numeric,
  quantity_to_buy numeric,
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
  comprar_plato numeric;
  total_comprar numeric;
  cairo_item record;
BEGIN
  -- 1. Crear una tabla temporal para consolidar las necesidades brutas
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
    dest text,
    meal_label text
  ) ON COMMIT DROP;

  -- 2. Recolectar necesidades de Desayuno, Almuerzo, Guarnición y Cena planificadas
  -- Desayuno
  INSERT INTO temp_needs
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR i.name ILIKE '%corte%' OR i.name ILIKE '%filet%'),
    COALESCE(ri.tipo_corte, 'Entera'),
    ri.quantity_per_portion * 20, -- Desayuno fijo 20 pax
    r.name || ' (Desayuno)',
    'Desayuno'
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.breakfast_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id;

  -- Almuerzo (Plato Principal)
  INSERT INTO temp_needs
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR i.name ILIKE '%corte%' OR i.name ILIKE '%filet%'),
    COALESCE(ri.tipo_corte, 'Entera'),
    ri.quantity_per_portion * mp.lunch_players,
    r.name || ' (Almuerzo)',
    'Almuerzo'
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0;

  -- Guarnición
  INSERT INTO temp_needs
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR i.name ILIKE '%corte%' OR i.name ILIKE '%filet%'),
    COALESCE(ri.tipo_corte, 'Entera'),
    ri.quantity_per_portion * mp.lunch_players,
    r.name || ' (Guarnición)',
    'Guarnición'
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.lunch_side_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.lunch_players > 0;

  -- Cena
  INSERT INTO temp_needs
  SELECT 
    ri.ingredient_id, i.name, ri.unit, s.name, s.id, s.phone, s.email,
    (s.id = 'd257d90b-ad0b-4f84-97a0-fee73612953c' OR s.name ILIKE '%cairo%' OR i.name ILIKE '%corte%' OR i.name ILIKE '%filet%'),
    COALESCE(ri.tipo_corte, 'Entera'),
    ri.quantity_per_portion * mp.dinner_players,
    r.name || ' (Cena)',
    'Cena'
  FROM public.menu_planner mp
  JOIN public.recipes r ON r.id = mp.dinner_recipe_id
  JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
  JOIN public.ingredients i ON i.id = ri.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE mp.dinner_players > 0;

  -- 3. Calcular cantidades y realizar restas de stock por proveedor
  FOR temp_row IN 
    SELECT tn.ing_id, tn.ing_name, tn.ing_unit, tn.supp_name, tn.supp_id, tn.supp_phone, tn.supp_email, tn.is_cairo, tn.corte,
           SUM(tn.qty) as total_qty, string_agg(distinct tn.dest, ', ') as all_dests
    FROM temp_needs tn
    GROUP BY tn.ing_id, tn.ing_name, tn.ing_unit, tn.supp_name, tn.supp_id, tn.supp_phone, tn.supp_email, tn.is_cairo, tn.corte
  LOOP
    ingredient_id := temp_row.ing_id;
    ingredient_name := temp_row.ing_name;
    unit := temp_row.ing_unit;
    supplier_name := COALESCE(temp_row.supp_name, 'Sin proveedor asignado');
    supplier_id := temp_row.supp_id;
    supplier_phone := temp_row.supp_phone;
    supplier_email := temp_row.supp_email;
    is_el_cairo := temp_row.is_cairo;
    tipo_corte := temp_row.corte;
    quantity_required := temp_row.total_qty;

    -- Obtener stock actual de la base de datos
    SELECT COALESCE(current_stock, 0) INTO db_stock FROM public.ingredients WHERE id = temp_row.ing_id;

    -- Lógica de descuento de stock
    IF is_el_cairo THEN
      -- Descuento secuencial por bandeja/plato
      stock_restante := db_stock;
      total_comprar := 0;

      FOR cairo_item IN SELECT qty, meal_label FROM temp_needs WHERE ing_id = temp_row.ing_id AND corte = temp_row.corte
      LOOP
        needed := cairo_item.qty;
        descontado := LEAST(needed, stock_restante);
        stock_restante := stock_restante - descontado;
        comprar_plato := GREATEST(0, needed - descontado);
        total_comprar := total_comprar + comprar_plato;
      END LOOP;

      quantity_to_buy := total_comprar;
    ELSE
      -- Descuento global simple
      quantity_to_buy := GREATEST(0, quantity_required - db_stock);
    END IF;

    destinations := temp_row.all_dests;
    RETURN NEXT;
  END LOOP;
END;
$$;
