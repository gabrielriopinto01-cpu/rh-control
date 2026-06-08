-- ============================================================
-- RH Control — Tabelas faltando
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── 1. ANNOUNCEMENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by           uuid REFERENCES profiles(id),
  title                text NOT NULL,
  content              text NOT NULL,
  type                 text NOT NULL DEFAULT 'info'
                         CHECK (type IN ('info', 'warning', 'urgent')),
  target_audience      text NOT NULL DEFAULT 'all'
                         CHECK (target_audience IN ('all', 'department')),
  target_department_id uuid REFERENCES departments(id),
  is_active            boolean NOT NULL DEFAULT true,
  expires_at           timestamptz,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  read_at         timestamptz DEFAULT now(),
  UNIQUE(announcement_id, employee_id)
);

-- ─── 2. AUDIT LOGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES profiles(id),
  user_email  text,
  user_role   text,
  action      text NOT NULL,
  resource    text NOT NULL,
  resource_id text,
  description text,
  created_at  timestamptz DEFAULT now()
);

-- ─── 3. CALENDAR EVENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title         text NOT NULL,
  date          date NOT NULL,
  end_date      date,
  type          text NOT NULL DEFAULT 'event',
  color         text DEFAULT '#2563eb',
  department_id uuid REFERENCES departments(id),
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now()
);

-- ─── 4. DIGITAL SIGNATURES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_signatures (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES profiles(id),
  document_name    text NOT NULL,
  document_type    text NOT NULL,
  document_html    text,
  token            uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','viewed','signed','rejected','expired')),
  sent_at          timestamptz DEFAULT now(),
  viewed_at        timestamptz,
  signed_at        timestamptz,
  signed_ip        text,
  rejection_reason text,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signature_audit_trail (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  signature_id uuid NOT NULL REFERENCES digital_signatures(id) ON DELETE CASCADE,
  event        text NOT NULL,
  description  text,
  created_at   timestamptz DEFAULT now()
);

-- ─── ÍNDICES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_announcements_company   ON announcements(company_id);
CREATE INDEX IF NOT EXISTS idx_ann_reads_announcement  ON announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company      ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_company ON calendar_events(company_id);
CREATE INDEX IF NOT EXISTS idx_dig_sig_company         ON digital_signatures(company_id);
CREATE INDEX IF NOT EXISTS idx_dig_sig_token           ON digital_signatures(token);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE announcements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_signatures    ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_audit_trail ENABLE ROW LEVEL SECURITY;

-- Announcements
CREATE POLICY IF NOT EXISTS "ann_select" ON announcements FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY IF NOT EXISTS "ann_insert" ON announcements FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY IF NOT EXISTS "ann_update" ON announcements FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY IF NOT EXISTS "ann_delete" ON announcements FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Announcement reads
CREATE POLICY IF NOT EXISTS "ann_reads_select" ON announcement_reads FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ann_reads_insert" ON announcement_reads FOR INSERT TO authenticated WITH CHECK (true);

-- Audit logs
CREATE POLICY IF NOT EXISTS "audit_select" ON audit_logs FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY IF NOT EXISTS "audit_insert" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Calendar events
CREATE POLICY IF NOT EXISTS "cal_select" ON calendar_events FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY IF NOT EXISTS "cal_insert" ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY IF NOT EXISTS "cal_update" ON calendar_events FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY IF NOT EXISTS "cal_delete" ON calendar_events FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Digital signatures
CREATE POLICY IF NOT EXISTS "digsig_select" ON digital_signatures FOR SELECT
  USING (true);  -- público: necessário para página /sign/[token] sem auth
CREATE POLICY IF NOT EXISTS "digsig_insert" ON digital_signatures FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY IF NOT EXISTS "digsig_update" ON digital_signatures FOR UPDATE
  USING (true);  -- público: colaborador sem auth pode assinar via token

-- Signature audit trail
CREATE POLICY IF NOT EXISTS "sig_trail_select" ON signature_audit_trail FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "sig_trail_insert" ON signature_audit_trail FOR INSERT USING (true) WITH CHECK (true);

-- ─── STORAGE — já criados, mas garante se não existir ─────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars',   'avatars',   true),
       ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies para avatars
CREATE POLICY IF NOT EXISTS "avatars_select_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY IF NOT EXISTS "avatars_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');
CREATE POLICY IF NOT EXISTS "avatars_update_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

-- Storage policies para documents
CREATE POLICY IF NOT EXISTS "documents_select_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');
CREATE POLICY IF NOT EXISTS "documents_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');
CREATE POLICY IF NOT EXISTS "documents_update_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents');
CREATE POLICY IF NOT EXISTS "documents_delete_auth" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
