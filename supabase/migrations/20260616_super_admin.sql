-- ============================================================
-- RH Control — Super Admin GRP (admin global da plataforma)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Admins da plataforma (donos do SaaS) — visão cross-empresa
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id    uuid PRIMARY KEY,
  email      text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Cada um só enxerga a própria linha (a página usa isso pra checar acesso)
DROP POLICY IF EXISTS "platform_admins_self" ON platform_admins;
CREATE POLICY "platform_admins_self" ON platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Bootstrap: marca os e-mails do dono como admin de plataforma
INSERT INTO platform_admins (user_id, email)
SELECT id, email FROM auth.users
WHERE email IN ('gabrielriopinto@gmail.com', 'gabrielriopinto01@gmail.com')
ON CONFLICT (user_id) DO NOTHING;
