-- ============================================================
-- RH Control — Checklists de Admissão (onboarding) e Desligamento (offboarding)
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_checklists (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('onboarding','offboarding')),
  items       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ label, done }]
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklists_company  ON employee_checklists(company_id);
CREATE INDEX IF NOT EXISTS idx_checklists_employee ON employee_checklists(employee_id);

ALTER TABLE employee_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checklists_all" ON employee_checklists;
CREATE POLICY "checklists_all" ON employee_checklists FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
