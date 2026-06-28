-- ============================================================
-- RH Control — Integração ASAAS (pagamento SaaS)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS asaas_customer_id     text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS asaas_subscription_id text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_status           text DEFAULT 'inactive';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_expires_at       timestamptz;
