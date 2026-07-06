-- Migration: Add operational metrics to recipes table
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS tiempo_elaboracion SMALLINT DEFAULT 1 CHECK (tiempo_elaboracion BETWEEN 1 AND 3),
ADD COLUMN IF NOT EXISTS dificultad SMALLINT DEFAULT 1 CHECK (dificultad BETWEEN 1 AND 3),
ADD COLUMN IF NOT EXISTS valoracion SMALLINT DEFAULT 1 CHECK (valoracion BETWEEN 1 AND 3);
