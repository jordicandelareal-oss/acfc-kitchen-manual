-- ================================================================
-- MIGRATION 006: Add portions column to recipes table
-- Ejecutar en Supabase SQL Editor
-- ================================================================

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS portions INTEGER NOT NULL DEFAULT 1;
