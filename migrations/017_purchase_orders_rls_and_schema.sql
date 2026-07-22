-- MIGRATION 017: Enable RLS Policies & Schema for purchase_orders and purchase_order_items

-- Make supplier_id nullable so orders can be created without mandatory supplier
ALTER TABLE public.purchase_orders ALTER COLUMN supplier_id DROP NOT NULL;

-- Enable RLS on both tables
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read on purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow public write on purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow public select purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow public insert purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow public update purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow public delete purchase_orders" ON public.purchase_orders;

DROP POLICY IF EXISTS "Allow public read on purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Allow public write on purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Allow public select purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Allow public insert purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Allow public update purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Allow public delete purchase_order_items" ON public.purchase_order_items;

-- Create full CRUD RLS policies for web application
CREATE POLICY "Allow public select purchase_orders" ON public.purchase_orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert purchase_orders" ON public.purchase_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update purchase_orders" ON public.purchase_orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete purchase_orders" ON public.purchase_orders FOR DELETE USING (true);

CREATE POLICY "Allow public select purchase_order_items" ON public.purchase_order_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert purchase_order_items" ON public.purchase_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update purchase_order_items" ON public.purchase_order_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete purchase_order_items" ON public.purchase_order_items FOR DELETE USING (true);
