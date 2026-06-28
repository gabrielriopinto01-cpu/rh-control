-- ============================================================
-- RH Control — Ponto eletrônico: batidas com geo/selfie/IP + cerca virtual
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Configuração de ponto por empresa (cerca virtual, selfie obrigatória)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS attendance_config jsonb DEFAULT '{}'::jsonb;
-- formato: { geofence_enabled: bool, lat: number, lng: number, radius_m: number, require_selfie: bool }

-- Batidas individuais (cada entrada/saída com metadados completos)
CREATE TABLE IF NOT EXISTS attendance_punches (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  record_id    uuid REFERENCES attendance_records(id) ON DELETE SET NULL,
  kind         text NOT NULL CHECK (kind IN ('in','lunch_start','lunch_end','out')),
  punched_at   timestamptz NOT NULL DEFAULT now(),
  latitude     double precision,
  longitude    double precision,
  address      text,
  selfie_url   text,
  ip           text,
  device       text,
  within_fence boolean,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punches_company  ON attendance_punches(company_id);
CREATE INDEX IF NOT EXISTS idx_punches_employee ON attendance_punches(employee_id, punched_at);
CREATE INDEX IF NOT EXISTS idx_punches_record   ON attendance_punches(record_id);

ALTER TABLE attendance_punches ENABLE ROW LEVEL SECURITY;

-- Vê batidas da própria empresa
DROP POLICY IF EXISTS "punches_select" ON attendance_punches;
DROP POLICY IF EXISTS "punches_insert" ON attendance_punches;
CREATE POLICY "punches_select" ON attendance_punches FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "punches_insert" ON attendance_punches FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Bucket para selfies do ponto (público para leitura simplificada)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance', 'attendance', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "attendance_select_public" ON storage.objects;
DROP POLICY IF EXISTS "attendance_insert_auth"   ON storage.objects;
CREATE POLICY "attendance_select_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'attendance');
CREATE POLICY "attendance_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attendance');
