-- ================================================================
-- MIGRATION ACFC Kitchen — Tabla ingredients (insumos)
-- Ejecutar en: https://supabase.com/dashboard/project/aosweyggyalowhogjatz/sql/new
-- ================================================================

-- 1. Añadir columnas de precios y proveedores
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS precio_por_kg          NUMERIC(12,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS precio_por_u           NUMERIC(12,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS precio_por_gramo       NUMERIC(12,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS precio_mas_bajo        NUMERIC(12,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proveedor_principal    VARCHAR(255)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS precios_por_proveedor  JSONB         DEFAULT '{}'::jsonb;

-- 2. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_ingredients_precios_jsonb
  ON ingredients USING GIN (precios_por_proveedor);
CREATE INDEX IF NOT EXISTS idx_ingredients_category
  ON ingredients (category);
CREATE INDEX IF NOT EXISTS idx_ingredients_subcategory
  ON ingredients (subcategory);
CREATE INDEX IF NOT EXISTS idx_ingredients_proveedor
  ON ingredients (proveedor_principal);

-- 3. Documentación de columnas
COMMENT ON COLUMN ingredients.precio_por_kg IS
  'Precio por KG o Litro (€). NULL si el insumo se vende por unidades.';
COMMENT ON COLUMN ingredients.precio_por_u IS
  'Precio por Unidad (€). NULL si se vende por peso/volumen.';
COMMENT ON COLUMN ingredients.precio_por_gramo IS
  'Precio normalizado por gramo/ml (€). Para cálculo de escandallos.';
COMMENT ON COLUMN ingredients.precio_mas_bajo IS
  'Mejor precio encontrado entre todos los proveedores.';
COMMENT ON COLUMN ingredients.precios_por_proveedor IS
  'JSONB dinámico: {"Mercadona": 1.25, "Makro": 1.10, ...}';
COMMENT ON COLUMN ingredients.proveedor_principal IS
  'Nombre del proveedor con el precio más competitivo.';

-- 4. Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ingredients'
ORDER BY ordinal_position;
