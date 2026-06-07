-- Storage policies para bucket avatars e documents
-- Execute este arquivo no Supabase Dashboard > SQL Editor

-- ─── AVATARS (público) ────────────────────────────────────────────────────────
-- Qualquer pessoa pode ler avatars (bucket é público)
CREATE POLICY IF NOT EXISTS "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Usuários autenticados podem fazer upload
CREATE POLICY IF NOT EXISTS "avatars_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Usuários autenticados podem substituir (upsert)
CREATE POLICY IF NOT EXISTS "avatars_update_auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');

-- ─── DOCUMENTS (privado) ──────────────────────────────────────────────────────
-- Apenas usuários autenticados da mesma empresa podem ler
CREATE POLICY IF NOT EXISTS "documents_select_auth"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- Upload apenas para autenticados
CREATE POLICY IF NOT EXISTS "documents_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- Substituição apenas para autenticados
CREATE POLICY IF NOT EXISTS "documents_update_auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents');

-- Delete apenas para autenticados
CREATE POLICY IF NOT EXISTS "documents_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents');
