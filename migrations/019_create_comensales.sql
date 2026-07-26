-- MIGRATION 019: Create comensales table for individual dietary profiles
CREATE TABLE IF NOT EXISTS public.comensales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    categoria_equipo VARCHAR(100), -- Ej: 'Juvenil A', 'Primer Equipo'
    dieta VARCHAR(50) DEFAULT 'Ninguna', -- 'Halal', 'Kosher', 'Vegano', 'Vegetariano', 'Ninguna'
    alergias TEXT, -- Ej: 'Gluten, Frutos secos'
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Añade índices recomendados para acelerar las consultas de filtrado en los contadores del Dashboard
CREATE INDEX IF NOT EXISTS idx_comensales_activo_dieta ON public.comensales(activo, dieta);

-- Habilitar RLS en la tabla comensales
ALTER TABLE public.comensales ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso público para lectura y escritura en comensales
DROP POLICY IF EXISTS "Allow public read on comensales" ON public.comensales;
DROP POLICY IF EXISTS "Allow public write on comensales" ON public.comensales;
CREATE POLICY "Allow public read on comensales" ON public.comensales FOR SELECT USING (true);
CREATE POLICY "Allow public write on comensales" ON public.comensales FOR ALL USING (true);
