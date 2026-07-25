-- MIGRATION 018: Create menu_weeks table and add week_id to menu_planner
CREATE TABLE IF NOT EXISTS menu_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    confirmado BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_start_end UNIQUE (start_date, end_date)
);

-- Enable RLS for menu_weeks
ALTER TABLE menu_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on menu_weeks" ON menu_weeks;
DROP POLICY IF EXISTS "Allow public write on menu_weeks" ON menu_weeks;
CREATE POLICY "Allow public read on menu_weeks" ON menu_weeks FOR SELECT USING (true);
CREATE POLICY "Allow public write on menu_weeks" ON menu_weeks FOR ALL USING (true);

-- Add week_id column to menu_planner referencing menu_weeks(id)
ALTER TABLE menu_planner ADD COLUMN IF NOT EXISTS week_id UUID REFERENCES menu_weeks(id) ON DELETE SET NULL;
