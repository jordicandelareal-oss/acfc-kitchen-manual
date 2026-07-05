-- MIGRATION 008: Add lunch_side_recipe_id to menu_planner
ALTER TABLE menu_planner ADD COLUMN IF NOT EXISTS lunch_side_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL;
