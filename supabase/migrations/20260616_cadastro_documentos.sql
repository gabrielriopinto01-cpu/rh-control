-- ============================================================
-- RH Control — CNH no colaborador + observações em documentos
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- CNH do colaborador
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS cnh text;

-- Gestor responsável (referência a outro colaborador)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES employees(id) ON DELETE SET NULL;

-- Observações nos documentos (a coluna 'type' já é text — aceita as novas categorias)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS notes text;
