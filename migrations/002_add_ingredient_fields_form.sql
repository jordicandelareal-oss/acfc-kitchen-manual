-- ================================================================
-- MIGRATION ACFC Kitchen — Tabla ingredients (insumos)
-- Ejecutar en: https://supabase.com/dashboard/project/aosweyggyalowhogjatz/sql/new
-- ================================================================

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS brand VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS provider_ref VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS purchase_format_gr NUMERIC(12,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS output_scenario VARCHAR(50) DEFAULT 'KG_LT' CHECK (output_scenario IN ('KG_LT', 'UNIDADES')),
  ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS waste_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (waste_percentage >= 0 AND waste_percentage <= 100),
  ADD COLUMN IF NOT EXISTS calculated_net_cost_kg NUMERIC(12,4) DEFAULT NULL;

COMMENT ON COLUMN ingredients.brand IS 'Marca del insumo';
COMMENT ON COLUMN ingredients.provider_ref IS 'Referencia del proveedor';
COMMENT ON COLUMN ingredients.purchase_format_gr IS 'Formato de compra (siempre almacenado en gramos)';
COMMENT ON COLUMN ingredients.purchase_price IS 'Precio de compra';
COMMENT ON COLUMN ingredients.output_scenario IS 'Escenario de salida: KG_LT o UNIDADES';
COMMENT ON COLUMN ingredients.provider_name IS 'Nombre del proveedor';
COMMENT ON COLUMN ingredients.waste_percentage IS 'Porcentaje de Merma / Hidratación (Valor entre 0 y 100)';
COMMENT ON COLUMN ingredients.calculated_net_cost_kg IS 'Coste neto calculado por KG/LT';
