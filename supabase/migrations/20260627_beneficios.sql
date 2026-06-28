-- Módulo de Benefícios: catálogo + vínculos por colaborador

CREATE TABLE IF NOT EXISTS benefits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  type         text NOT NULL, -- vt | vr | health | dental | life_insurance | gym | other
  description  text,
  value        numeric(10,2),       -- valor mensal (pode ser null p/ benefícios sem valor fixo)
  employee_discount numeric(10,2),  -- desconto mensal do colaborador
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_benefits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  benefit_id   uuid NOT NULL REFERENCES benefits(id) ON DELETE CASCADE,
  start_date   date NOT NULL DEFAULT CURRENT_DATE,
  end_date     date,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, benefit_id, start_date)
);

ALTER TABLE benefits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "benefits_company" ON benefits;
CREATE POLICY "benefits_company" ON benefits FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = benefits.company_id))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = benefits.company_id AND role IN ('adm_total','rh')));

DROP POLICY IF EXISTS "emp_benefits_select" ON employee_benefits;
CREATE POLICY "emp_benefits_select" ON employee_benefits FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = employee_benefits.company_id)
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('adm_total','rh','gestor'))
      OR employee_id IN (SELECT employee_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "emp_benefits_manage" ON employee_benefits;
CREATE POLICY "emp_benefits_manage" ON employee_benefits FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = employee_benefits.company_id AND role IN ('adm_total','rh')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = employee_benefits.company_id AND role IN ('adm_total','rh')));

CREATE INDEX IF NOT EXISTS idx_emp_benefits_employee ON employee_benefits(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_benefits_company  ON employee_benefits(company_id);
