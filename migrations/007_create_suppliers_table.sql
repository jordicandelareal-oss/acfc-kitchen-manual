-- ================================================================
-- Migration 007: CREATE public.suppliers desde cero
-- Ejecutar en: Supabase SQL Editor → https://app.supabase.com
-- ================================================================

-- 1. Asegurar que eliminamos cualquier rastro erróneo
DROP TABLE IF EXISTS public.suppliers CASCADE;

-- 2. Crear la tabla explícitamente en el esquema public
CREATE TABLE public.suppliers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL UNIQUE,
    contact_name TEXT,
    email        TEXT,
    phone        TEXT,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS con políticas abiertas (anon key puede leer/escribir)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE USING (true);
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE USING (true);

-- 4. Insertar los proveedores iniciales en la tabla correcta
INSERT INTO public.suppliers (name) VALUES
  ('Carniceria Samir'),
  ('Star Cash&Carry'),
  ('Chino centro'),
  ('Chino cash&carry'),
  ('Mercadona'),
  ('Makro');

-- 5. Verificar resultado (deberías ver 6 filas)
SELECT id, name, created_at FROM public.suppliers ORDER BY name;
