-- ================================================================
-- MIGRATION 005: Create recipes, recipe_ingredients, and recipe_categories tables
-- Ejecutar en Supabase SQL Editor
-- ================================================================

-- Create recipe_categories table
CREATE TABLE IF NOT EXISTS recipe_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure nutritional_category exists on ingredients
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS nutritional_category VARCHAR(100);

-- Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100), -- Legacy category string
    category_id UUID REFERENCES recipe_categories(id) ON DELETE SET NULL, -- Dynamic category relation
    instructions TEXT, -- Step by step preparation details
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create recipe_ingredients table (quantity_per_portion maps to quantity)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity_per_portion NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    unit VARCHAR(50) NOT NULL,
    UNIQUE(recipe_id, ingredient_id)
);

-- Enable RLS and public policies for development
ALTER TABLE recipe_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on recipe_categories" ON recipe_categories FOR SELECT USING (true);
CREATE POLICY "Allow public insert on recipe_categories" ON recipe_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on recipe_categories" ON recipe_categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on recipe_categories" ON recipe_categories FOR DELETE USING (true);

CREATE POLICY "Allow public select on recipes" ON recipes FOR SELECT USING (true);
CREATE POLICY "Allow public insert on recipes" ON recipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on recipes" ON recipes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on recipes" ON recipes FOR DELETE USING (true);

CREATE POLICY "Allow public select on recipe_ingredients" ON recipe_ingredients FOR SELECT USING (true);
CREATE POLICY "Allow public insert on recipe_ingredients" ON recipe_ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on recipe_ingredients" ON recipe_ingredients FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on recipe_ingredients" ON recipe_ingredients FOR DELETE USING (true);
