-- ============================================================
-- RH Control — WhatsApp multi-tenant (instância por empresa)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Cada empresa tem a própria instância Evolution (o próprio número de WhatsApp)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_instance text;
