-- Migration: Allow flexible output scenarios in ingredients check constraint
-- This migration updates the CHECK constraint to allow both 'KG_LT', 'UNIDADES', and 'UNIT' (along with lowercase variants)

-- 1. Drop existing constraint
ALTER TABLE public.ingredients 
  DROP CONSTRAINT IF EXISTS ingredients_output_scenario_check;

-- 2. Create updated constraint with flexible values
ALTER TABLE public.ingredients 
  ADD CONSTRAINT ingredients_output_scenario_check 
  CHECK (output_scenario IN ('KG_LT', 'UNIDADES', 'UNIT', 'kg_lt', 'unidades', 'unit'));
