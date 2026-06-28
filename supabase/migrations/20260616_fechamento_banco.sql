-- ============================================================
-- RH Control — Fechamento mensal do Banco de Horas + aprovação
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS time_bank_closures (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reference_month text NOT NULL,            -- 'YYYY-MM'
  worked_hours    numeric NOT NULL DEFAULT 0,
  overtime_hours  numeric NOT NULL DEFAULT 0,
  balance_hours   numeric NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  notes           text,
  approved_by     uuid REFERENCES profiles(id),
  approved_at     timestamptz,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(employee_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_closures_company ON time_bank_closures(company_id, reference_month);

ALTER TABLE time_bank_closures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "closures_all" ON time_bank_closures;
CREATE POLICY "closures_all" ON time_bank_closures FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
