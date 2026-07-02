-- ================================================================
-- MIGRATION 003: Add process_type column to ingredients
-- Ejecutar en: https://supabase.com/dashboard/project/aosweyggyalowhogjatz/sql/new
-- ================================================================

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS process_type VARCHAR(20) DEFAULT 'MERMA'
    CHECK (process_type IN ('MERMA', 'HIDRATACION'));

COMMENT ON COLUMN ingredients.process_type IS
  'Tipo de proceso de rendimiento: MERMA (pierde peso, coste/kg sube) o HIDRATACION (gana peso, coste/kg baja)';
