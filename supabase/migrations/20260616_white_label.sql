-- ============================================================
-- RH Control — White Label (branding por empresa)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Branding fica num único JSONB na empresa:
-- {
--   "primary":     "#2563eb",
--   "secondary":   "#1e40af",
--   "button":      "#2563eb",
--   "system_name": "RH Control",
--   "tagline":     "Gestão de pessoas",
--   "footer":      "© 2026 Sua Empresa"
-- }
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS branding jsonb DEFAULT '{}'::jsonb;
