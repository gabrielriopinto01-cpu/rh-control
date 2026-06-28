-- ============================================================
-- RH Control — Controle de Equipamentos / Ativos
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS equipment (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   uuid REFERENCES employees(id) ON DELETE SET NULL,
  name          text NOT NULL,
  category      text NOT NULL DEFAULT 'outro',
  -- categorias: notebook, celular, tablet, ferramenta, uniforme, veiculo,
  --             chave, cartao, cracha, outro
  identifier    text,            -- nº de série, patrimônio, placa, etc.
  status        text NOT NULL DEFAULT 'disponivel'
                  CHECK (status IN ('disponivel','entregue','devolvido','manutencao','baixado')),
  delivered_at  date,
  returned_at   date,
  photo_url     text,
  notes         text,
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_company  ON equipment(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_employee ON equipment(employee_id);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipment_all" ON equipment;
CREATE POLICY "equipment_all" ON equipment FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
