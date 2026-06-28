-- ============================================================
-- RH Control — Pesquisa de Clima Organizacional
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS climate_surveys (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  questions    jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ id, text }]
  is_active    boolean NOT NULL DEFAULT true,
  anonymous    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS climate_responses (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id    uuid NOT NULL REFERENCES climate_surveys(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id  uuid REFERENCES employees(id) ON DELETE SET NULL,
  answers      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { questionId: 1..5 }
  comment      text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_climate_surveys_company   ON climate_surveys(company_id);
CREATE INDEX IF NOT EXISTS idx_climate_responses_survey  ON climate_responses(survey_id);

ALTER TABLE climate_surveys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE climate_responses ENABLE ROW LEVEL SECURITY;

-- Pesquisas: gestão administra, todos da empresa leem (para responder)
DROP POLICY IF EXISTS "surveys_select" ON climate_surveys;
DROP POLICY IF EXISTS "surveys_write"  ON climate_surveys;
CREATE POLICY "surveys_select" ON climate_surveys FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "surveys_write" ON climate_surveys FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Respostas: qualquer um da empresa insere; leitura para relatórios (gestão usa agregação)
DROP POLICY IF EXISTS "responses_insert" ON climate_responses;
DROP POLICY IF EXISTS "responses_select" ON climate_responses;
CREATE POLICY "responses_insert" ON climate_responses FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "responses_select" ON climate_responses FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
