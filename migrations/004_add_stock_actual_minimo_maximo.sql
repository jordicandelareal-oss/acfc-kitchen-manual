-- ================================================================
-- MIGRATION 004: Add stock_actual, stock_minimo, and stock_maximo columns
-- Ejecutar en Supabase SQL Editor
-- ================================================================

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS stock_actual NUMERIC(12, 4) DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS stock_minimo NUMERIC(12, 4) DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS stock_maximo NUMERIC(12, 4) DEFAULT 0.0000;

-- Copy existing stock values if they exist in older columns
UPDATE ingredients
SET stock_actual = COALESCE(current_stock, 0.0000)
WHERE stock_actual = 0.0000;

UPDATE ingredients
SET stock_minimo = COALESCE(min_stock, minimum_stock, 0.0000)
WHERE stock_minimo = 0.0000;

COMMENT ON COLUMN ingredients.stock_actual IS 'Cantidad real en el almacén (en gramos o unidades)';
COMMENT ON COLUMN ingredients.stock_minimo IS 'Umbral mínimo permitido antes de disparar alerta';
COMMENT ON COLUMN ingredients.stock_maximo IS 'Capacidad ideal o techo de stock';
