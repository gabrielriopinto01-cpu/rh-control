-- OKRs e PDI (Plano de Desenvolvimento Individual)

CREATE TABLE IF NOT EXISTS okrs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cycle        text NOT NULL,           -- ex: '2026-Q1', '2026-S1', '2026'
  objective    text NOT NULL,
  status       text NOT NULL DEFAULT 'active', -- active | achieved | cancelled
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS key_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id       uuid NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  description  text NOT NULL,
  target       numeric(10,2) NOT NULL DEFAULT 100,
  current      numeric(10,2) NOT NULL DEFAULT 0,
  unit         text NOT NULL DEFAULT '%',  -- %, R$, un, etc
  due_date     date,
  status       text NOT NULL DEFAULT 'on_track', -- on_track | at_risk | achieved | missed
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pdi_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  category     text NOT NULL DEFAULT 'skill', -- skill | behavior | knowledge | career
  target_date  date,
  status       text NOT NULL DEFAULT 'pending', -- pending | in_progress | done | cancelled
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE okrs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdi_items   ENABLE ROW LEVEL SECURITY;

-- OKRs: empresa vê, colaborador vê o próprio
DROP POLICY IF EXISTS "okrs_select" ON okrs;
CREATE POLICY "okrs_select" ON okrs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = okrs.company_id)
    AND (
      employee_id IN (SELECT employee_id FROM profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('adm_total','rh','gestor'))
    )
  );

DROP POLICY IF EXISTS "okrs_manage" ON okrs;
CREATE POLICY "okrs_manage" ON okrs FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = okrs.company_id AND role IN ('adm_total','rh','gestor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = okrs.company_id AND role IN ('adm_total','rh','gestor')));

-- Key Results: herda do OKR pai
DROP POLICY IF EXISTS "kr_select" ON key_results;
CREATE POLICY "kr_select" ON key_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN profiles p ON p.company_id = o.company_id AND p.id = auth.uid()
      WHERE o.id = key_results.okr_id
        AND (o.employee_id IN (SELECT employee_id FROM profiles WHERE id = auth.uid())
             OR p.role IN ('adm_total','rh','gestor'))
    )
  );

DROP POLICY IF EXISTS "kr_manage" ON key_results;
CREATE POLICY "kr_manage" ON key_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN profiles p ON p.company_id = o.company_id AND p.id = auth.uid()
      WHERE o.id = key_results.okr_id AND p.role IN ('adm_total','rh','gestor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN profiles p ON p.company_id = o.company_id AND p.id = auth.uid()
      WHERE o.id = key_results.okr_id AND p.role IN ('adm_total','rh','gestor')
    )
  );

-- PDI
DROP POLICY IF EXISTS "pdi_select" ON pdi_items;
CREATE POLICY "pdi_select" ON pdi_items FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = pdi_items.company_id)
    AND (
      employee_id IN (SELECT employee_id FROM profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('adm_total','rh','gestor'))
    )
  );

DROP POLICY IF EXISTS "pdi_manage" ON pdi_items;
CREATE POLICY "pdi_manage" ON pdi_items FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = pdi_items.company_id AND role IN ('adm_total','rh','gestor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = pdi_items.company_id AND role IN ('adm_total','rh','gestor')));

-- Colaborador pode atualizar status do próprio PDI
DROP POLICY IF EXISTS "pdi_self_update" ON pdi_items;
CREATE POLICY "pdi_self_update" ON pdi_items FOR UPDATE TO authenticated
  USING (
    employee_id IN (SELECT employee_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = pdi_items.company_id)
  );

CREATE INDEX IF NOT EXISTS idx_okrs_employee   ON okrs(employee_id);
CREATE INDEX IF NOT EXISTS idx_okrs_company    ON okrs(company_id);
CREATE INDEX IF NOT EXISTS idx_kr_okr          ON key_results(okr_id);
CREATE INDEX IF NOT EXISTS idx_pdi_employee    ON pdi_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_pdi_company     ON pdi_items(company_id);
