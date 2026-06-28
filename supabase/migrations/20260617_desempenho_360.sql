-- ============================================================
-- RH Control — Avaliação de Desempenho 360° + autoavaliação
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- Tipo da avaliação: manager (gestor), self (autoavaliação), peer (par/360)
ALTER TABLE performance_reviews
  ADD COLUMN IF NOT EXISTS review_type text NOT NULL DEFAULT 'manager';

-- Garante que o colaborador consiga criar/ver a própria autoavaliação
-- (caso a policy atual seja só por company_id, isto já cobre; mantido por segurança)
DROP POLICY IF EXISTS "perf_self_manage" ON performance_reviews;
CREATE POLICY "perf_self_manage" ON performance_reviews FOR ALL TO authenticated
  USING (
    employee_id IN (SELECT employee_id FROM profiles WHERE id = auth.uid())
    OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );
