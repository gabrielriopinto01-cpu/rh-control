-- ============================================================
-- RH Control — Crachá Inteligente (QR Code + página pública)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Token e status do crachá no colaborador
ALTER TABLE employees ADD COLUMN IF NOT EXISTS badge_token uuid DEFAULT gen_random_uuid();
ALTER TABLE employees ADD COLUMN IF NOT EXISTS badge_active boolean DEFAULT true;

-- Garante token único e preenche quem estiver nulo
UPDATE employees SET badge_token = gen_random_uuid() WHERE badge_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_badge_token ON employees(badge_token);

-- RPC pública: retorna apenas os dados seguros do crachá para um token válido
CREATE OR REPLACE FUNCTION public_badge(p_token uuid)
RETURNS TABLE (
  full_name     text,
  employee_code text,
  status        text,
  avatar_url    text,
  badge_active  boolean,
  position_title text,
  department_name text,
  company_name  text,
  company_logo  text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT e.full_name, e.employee_code, e.status, e.avatar_url, e.badge_active,
         p.title, d.name, c.name, c.logo_url
  FROM employees e
  LEFT JOIN positions   p ON p.id = e.position_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN companies   c ON c.id = e.company_id
  WHERE e.badge_token = p_token
    AND e.badge_active = true;
$$;

-- Permite chamada anônima (página pública do crachá)
GRANT EXECUTE ON FUNCTION public_badge(uuid) TO anon, authenticated;
