-- ============================================================
-- RH Control — Treinamentos (LMS) + Conclusões / Certificados
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS trainings (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  content_type text NOT NULL DEFAULT 'video' CHECK (content_type IN ('video','pdf','link')),
  content_url  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_completions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id  uuid NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  score        integer,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(training_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_trainings_company    ON trainings(company_id);
CREATE INDEX IF NOT EXISTS idx_tcompletions_company ON training_completions(company_id);
CREATE INDEX IF NOT EXISTS idx_tcompletions_emp     ON training_completions(employee_id);

ALTER TABLE trainings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainings_all" ON trainings;
CREATE POLICY "trainings_all" ON trainings FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tcompletions_all" ON training_completions;
CREATE POLICY "tcompletions_all" ON training_completions FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
