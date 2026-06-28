-- ============================================================
-- RH Control — Atestados médicos + Afastamentos / Ocorrências
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── ATESTADOS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_certificates (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doctor_name  text,
  crm          text,
  cid          text,
  start_date   date NOT NULL,
  days         integer NOT NULL DEFAULT 1,
  file_url     text,
  notes        text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- ─── AFASTAMENTOS / OCORRÊNCIAS ───────────────────────────────
CREATE TABLE IF NOT EXISTS leaves (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type         text NOT NULL,
  -- tipos: inss, maternidade, paternidade, obito, casamento, acidente,
  --        suspensao, falta_abonada, falta, advertencia, outro
  start_date   date NOT NULL,
  end_date     date,
  reason       text,
  file_url     text,
  notes        text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certs_company  ON medical_certificates(company_id);
CREATE INDEX IF NOT EXISTS idx_certs_employee ON medical_certificates(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_company  ON leaves(company_id);
CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leaves(employee_id);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE medical_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves               ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "certs_select" ON medical_certificates;
DROP POLICY IF EXISTS "certs_insert" ON medical_certificates;
DROP POLICY IF EXISTS "certs_update" ON medical_certificates;
DROP POLICY IF EXISTS "certs_delete" ON medical_certificates;
CREATE POLICY "certs_select" ON medical_certificates FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "certs_insert" ON medical_certificates FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "certs_update" ON medical_certificates FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "certs_delete" ON medical_certificates FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "leaves_select" ON leaves;
DROP POLICY IF EXISTS "leaves_insert" ON leaves;
DROP POLICY IF EXISTS "leaves_update" ON leaves;
DROP POLICY IF EXISTS "leaves_delete" ON leaves;
CREATE POLICY "leaves_select" ON leaves FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "leaves_insert" ON leaves FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "leaves_update" ON leaves FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "leaves_delete" ON leaves FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
