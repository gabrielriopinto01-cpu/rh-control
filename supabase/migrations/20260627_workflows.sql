-- Workflows de aprovação multi-nível (férias, ajuste de ponto, outros)

CREATE TABLE IF NOT EXISTS approval_workflows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  type         text NOT NULL, -- 'vacation' | 'time_adjustment' | 'leave' | 'other'
  steps        jsonb NOT NULL DEFAULT '[]', -- [{role, label}]
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_id     uuid REFERENCES approval_workflows(id),
  type            text NOT NULL,
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requester_id    uuid NOT NULL REFERENCES profiles(id),
  reference_id    uuid,           -- id da féria/leave/etc relacionado
  payload         jsonb NOT NULL DEFAULT '{}', -- dados do pedido
  current_step    int  NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending', -- pending|approved|rejected|cancelled
  rejection_reason text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE TABLE IF NOT EXISTS approval_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  approver_id     uuid NOT NULL REFERENCES profiles(id),
  approver_role   text NOT NULL,
  step            int  NOT NULL,
  action          text NOT NULL, -- 'approve' | 'reject'
  comment         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE approval_workflows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions     ENABLE ROW LEVEL SECURITY;

-- Workflows: adm_total/rh gerenciam, gestor vê
DROP POLICY IF EXISTS "wf_manage" ON approval_workflows;
CREATE POLICY "wf_manage" ON approval_workflows FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = approval_workflows.company_id
            AND role IN ('adm_total', 'rh', 'gestor'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = approval_workflows.company_id
            AND role IN ('adm_total', 'rh'))
  );

-- Requests: colaborador vê as próprias, gestor/rh/adm veem da empresa
DROP POLICY IF EXISTS "ar_select" ON approval_requests;
CREATE POLICY "ar_select" ON approval_requests FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = approval_requests.company_id)
    AND (
      requester_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('adm_total', 'rh', 'gestor'))
    )
  );

DROP POLICY IF EXISTS "ar_insert" ON approval_requests;
CREATE POLICY "ar_insert" ON approval_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = approval_requests.company_id)
  );

DROP POLICY IF EXISTS "ar_update" ON approval_requests;
CREATE POLICY "ar_update" ON approval_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = approval_requests.company_id
            AND role IN ('adm_total', 'rh', 'gestor'))
  );

-- Actions: quem aprovou/rejeitou + quem pediu podem ver
DROP POLICY IF EXISTS "aa_select" ON approval_actions;
CREATE POLICY "aa_select" ON approval_actions FOR SELECT TO authenticated
  USING (
    approver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM approval_requests ar
      JOIN profiles p ON p.id = auth.uid()
      WHERE ar.id = approval_actions.request_id
        AND (ar.requester_id = auth.uid() OR p.role IN ('adm_total', 'rh', 'gestor'))
    )
  );

DROP POLICY IF EXISTS "aa_insert" ON approval_actions;
CREATE POLICY "aa_insert" ON approval_actions FOR INSERT TO authenticated
  WITH CHECK (approver_id = auth.uid());

-- Índices
CREATE INDEX IF NOT EXISTS idx_approval_requests_company  ON approval_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_employee ON approval_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status   ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_actions_request   ON approval_actions(request_id);
