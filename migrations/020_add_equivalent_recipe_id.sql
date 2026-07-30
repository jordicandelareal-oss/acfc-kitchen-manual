-- Migración: Añadir equivalent_recipe_id y mejorar get_vegetarian_alternative

ALTER TABLE public.recipes 
ADD COLUMN IF NOT EXISTS equivalent_recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.get_vegetarian_alternative(main_recipe_id uuid) RETURNS uuid AS $$
DECLARE
  v_name varchar;
  v_is_veg boolean;
  v_cat varchar;
  v_alt_id uuid;
  v_equiv_id uuid;
BEGIN
  SELECT name, is_vegetarian, category, equivalent_recipe_id 
  INTO v_name, v_is_veg, v_cat, v_equiv_id
  FROM public.recipes WHERE id = main_recipe_id;
  
  -- Si ya es vegetariana, devolverla misma
  IF v_is_veg = true OR v_cat ILIKE 'Vegetariano' THEN
    RETURN main_recipe_id;
  END IF;

  -- Prioridad 1: Relación Directa (equivalent_recipe_id)
  IF v_equiv_id IS NOT NULL THEN
    RETURN v_equiv_id;
  END IF;

  -- Prioridad 2: Coincidencia de Nombre Base
  SELECT id INTO v_alt_id FROM public.recipes 
  WHERE (name ILIKE v_name || ' (Vegetarian)%' OR name ILIKE v_name || ' (vegetariano)%')
    AND (is_vegetarian = true OR category ILIKE 'Vegetariano')
  LIMIT 1;

  IF v_alt_id IS NOT NULL THEN RETURN v_alt_id; END IF;

  -- Prioridad 3: Fallback (primera disponible vegetariana)
  SELECT id INTO v_alt_id FROM public.recipes 
  WHERE is_vegetarian = true OR category ILIKE 'Vegetariano'
  ORDER BY name ASC
  LIMIT 1;

  RETURN COALESCE(v_alt_id, main_recipe_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
