-- MIGRACIÓN 015: Sistema de Roles de Usuario (RBAC) y Seguridad RLS
-- Roles estándar en inglés: 'admin', 'chef', 'assistant'

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  role character varying(50) NOT NULL DEFAULT 'chef'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_key UNIQUE (user_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Habilitar Row Level Security (RLS) con lectura segura
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de roles a usuarios autenticados y anon" ON public.user_roles;
CREATE POLICY "Permitir lectura de roles a usuarios autenticados y anon" 
ON public.user_roles FOR SELECT USING (true);

-- Asignación dinámica por coincidencia de patrón de correo (ej. alias con +admin, +chef, +assistant)
DO $$
BEGIN
  -- Insertar o actualizar rol para Admin (coincidencia con '%admin%')
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'
  FROM auth.users
  WHERE email LIKE '%admin%'
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  -- Insertar o actualizar rol para Chef (coincidencia con '%chef%')
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'chef'
  FROM auth.users
  WHERE email LIKE '%chef%'
  ON CONFLICT (user_id) DO UPDATE SET role = 'chef';

  -- Insertar o actualizar rol para Asistente (coincidencia con '%assistant%')
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'assistant'
  FROM auth.users
  WHERE email LIKE '%assistant%'
  ON CONFLICT (user_id) DO UPDATE SET role = 'assistant';
END $$;
