-- ============================================================
-- RH Control — Chat interno + Acesso do colaborador
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── 1. THREADS (conversas) ───────────────────────────────────
-- kind: 'direct' (1:1), 'department' (setor), 'company' (todos)
CREATE TABLE IF NOT EXISTS chat_threads (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'direct'
                    CHECK (kind IN ('direct', 'department', 'company')),
  department_id   uuid REFERENCES departments(id) ON DELETE CASCADE,
  title           text,
  created_by      uuid REFERENCES profiles(id),
  last_message_at timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- Garante 1 thread por departamento e 1 por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_thread_department
  ON chat_threads(department_id) WHERE kind = 'department';
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_thread_company
  ON chat_threads(company_id) WHERE kind = 'company';

-- ─── 2. MEMBROS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_thread_members (
  thread_id    uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (thread_id, profile_id)
);

-- ─── 3. MENSAGENS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id  uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ─── ÍNDICES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_threads_company  ON chat_threads(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_profile  ON chat_thread_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread  ON chat_messages(thread_id, created_at);

-- ─── HELPER: é membro da thread? (evita recursão de RLS) ───────
CREATE OR REPLACE FUNCTION is_chat_member(p_thread uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_thread_members
    WHERE thread_id = p_thread AND profile_id = auth.uid()
  );
$$;

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE chat_threads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages       ENABLE ROW LEVEL SECURITY;

-- Threads: vejo as que sou membro
DROP POLICY IF EXISTS "chat_threads_select" ON chat_threads;
DROP POLICY IF EXISTS "chat_threads_insert" ON chat_threads;
DROP POLICY IF EXISTS "chat_threads_update" ON chat_threads;
CREATE POLICY "chat_threads_select" ON chat_threads FOR SELECT TO authenticated
  USING (is_chat_member(id));
CREATE POLICY "chat_threads_insert" ON chat_threads FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "chat_threads_update" ON chat_threads FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Membros: vejo membros das threads que participo
DROP POLICY IF EXISTS "chat_members_select" ON chat_thread_members;
DROP POLICY IF EXISTS "chat_members_insert" ON chat_thread_members;
DROP POLICY IF EXISTS "chat_members_update" ON chat_thread_members;
CREATE POLICY "chat_members_select" ON chat_thread_members FOR SELECT TO authenticated
  USING (is_chat_member(thread_id));
CREATE POLICY "chat_members_insert" ON chat_thread_members FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "chat_members_update" ON chat_thread_members FOR UPDATE TO authenticated
  USING (profile_id = auth.uid());

-- Mensagens: vejo as das threads que participo; envio como eu mesmo
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT TO authenticated
  USING (is_chat_member(thread_id));
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_chat_member(thread_id));

-- ─── REALTIME ─────────────────────────────────────────────────
-- Adiciona as tabelas à publicação de realtime (ignora se já estiver)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_threads;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
