-- ─── Automações de WhatsApp / Notificações ────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_rules (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event        text NOT NULL, -- vacation_approved, vacation_rejected, approval_requested, birthday, document_expiring, payroll_closed, employee_admitted
  channel      text NOT NULL DEFAULT 'whatsapp', -- whatsapp | email (futuro)
  active       boolean NOT NULL DEFAULT true,
  template     text NOT NULL, -- mensagem com variáveis {{nome}}, {{data}}, etc.
  send_to      text NOT NULL DEFAULT 'employee', -- employee | manager | rh | all
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_id         uuid REFERENCES automation_rules(id) ON DELETE SET NULL,
  event           text NOT NULL,
  recipient_name  text,
  recipient_phone text,
  message         text,
  status          text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_rules_company" ON automation_rules;
CREATE POLICY "automation_rules_company" ON automation_rules
  FOR ALL USING (company_id = public.my_company_id());

DROP POLICY IF EXISTS "automation_logs_company" ON automation_logs;
CREATE POLICY "automation_logs_company" ON automation_logs
  FOR ALL USING (company_id = public.my_company_id());

-- Regras padrão inseridas automaticamente via função (chamada pelo código após criar empresa)
