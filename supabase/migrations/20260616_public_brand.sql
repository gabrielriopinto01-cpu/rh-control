-- ============================================================
-- RH Control — Branding público por slug (login White Label)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public_company_brand(p_slug text)
RETURNS TABLE (
  name     text,
  logo_url text,
  branding jsonb
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT c.name, c.logo_url, c.branding
  FROM companies c
  WHERE c.slug = p_slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public_company_brand(text) TO anon, authenticated;
