-- ============================================================
-- Migration 004: Sprint Comercial
-- Assinatura Digital, Comunicados, Calendário, Organograma
-- ============================================================

-- ─── 1. Expandir audit_logs ──────────────────────────────────
-- (tabela já existe — apenas adicionar coluna user_agent se ausente)
alter table public.audit_logs
  add column if not exists user_agent text;

-- Trigger de férias (aprovação / rejeição)
create or replace function public.audit_vacations_trigger()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    perform public.log_audit('CREATE', 'vacations', NEW.id::text,
      'Solicitação de férias criada',
      jsonb_build_object('employee_id', NEW.employee_id, 'start', NEW.start_date, 'end', NEW.end_date)
    );
  elsif TG_OP = 'UPDATE' and OLD.status <> NEW.status then
    perform public.log_audit(
      case NEW.status when 'approved' then 'APPROVE' else 'REJECT' end,
      'vacations', NEW.id::text,
      'Férias ' || case NEW.status when 'approved' then 'aprovadas' else 'rejeitadas' end,
      jsonb_build_object('employee_id', NEW.employee_id)
    );
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists audit_vacations on public.vacations;
create trigger audit_vacations
  after insert or update on public.vacations
  for each row execute function public.audit_vacations_trigger();

-- Trigger de documentos (upload)
create or replace function public.audit_documents_trigger()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    perform public.log_audit('UPLOAD', 'documents', NEW.id::text,
      'Documento enviado: ' || coalesce(NEW.name, NEW.file_name, 'arquivo'),
      jsonb_build_object('employee_id', NEW.employee_id, 'type', NEW.document_type)
    );
  elsif TG_OP = 'DELETE' then
    perform public.log_audit('DELETE', 'documents', OLD.id::text,
      'Documento removido: ' || coalesce(OLD.name, OLD.file_name, 'arquivo'), null
    );
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists audit_documents on public.documents;
create trigger audit_documents
  after insert or delete on public.documents
  for each row execute function public.audit_documents_trigger();

-- ─── 2. Comunicados Internos ─────────────────────────────────
create table if not exists public.announcements (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  title                text not null,
  content              text not null,
  type                 text not null default 'info',  -- info | warning | urgent
  target_audience      text not null default 'all',   -- all | department | position
  target_department_id uuid references public.departments(id) on delete set null,
  is_active            boolean not null default true,
  expires_at           timestamptz,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create table if not exists public.announcement_reads (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  read_at         timestamptz default now(),
  unique (announcement_id, employee_id)
);

create index if not exists announcements_company_id_idx   on public.announcements(company_id);
create index if not exists announcements_is_active_idx    on public.announcements(is_active, expires_at);
create index if not exists announcement_reads_emp_idx     on public.announcement_reads(employee_id);

-- RLS comunicados
alter table public.announcements       enable row level security;
alter table public.announcement_reads  enable row level security;

create policy "announcements_select" on public.announcements
  for select using (company_id = public.my_company_id() and is_active = true);

create policy "announcements_manage" on public.announcements
  for all using (
    company_id = public.my_company_id()
    and public.my_role() in ('adm_total', 'rh')
  );

create policy "announcement_reads_insert" on public.announcement_reads
  for insert with check (
    employee_id = public.my_employee_id()
  );

create policy "announcement_reads_select" on public.announcement_reads
  for select using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_id and a.company_id = public.my_company_id()
    )
  );

-- ─── 3. Eventos do Calendário ────────────────────────────────
create table if not exists public.calendar_events (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  title             text not null,
  description       text,
  date              date not null,
  end_date          date,
  type              text not null default 'event', -- event | holiday | birthday | meeting
  department_id     uuid references public.departments(id) on delete set null,
  color             text default '#2563eb',
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz default now()
);

create index if not exists calendar_events_company_month_idx
  on public.calendar_events(company_id, date);

alter table public.calendar_events enable row level security;

create policy "calendar_events_select" on public.calendar_events
  for select using (company_id = public.my_company_id());

create policy "calendar_events_manage" on public.calendar_events
  for all using (
    company_id = public.my_company_id()
    and public.my_role() in ('adm_total', 'rh', 'gestor')
  );

-- ─── 4. Assinatura Digital ───────────────────────────────────
create table if not exists public.digital_signatures (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  document_name   text not null,
  document_type   text not null default 'contract', -- contract | warning | holerite | lgpd | policy
  document_url    text,                             -- storage path do arquivo
  document_html   text,                             -- conteúdo HTML inline (opcional)
  status          text not null default 'pending',  -- pending | viewed | signed | rejected | expired
  token           uuid unique not null default gen_random_uuid(),
  expires_at      timestamptz not null default now() + interval '7 days',
  sent_at         timestamptz default now(),
  viewed_at       timestamptz,
  signed_at       timestamptz,
  signed_ip       text,
  signed_user_agent text,
  rejection_reason text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now()
);

create table if not exists public.signature_audit_trail (
  id            uuid primary key default gen_random_uuid(),
  signature_id  uuid not null references public.digital_signatures(id) on delete cascade,
  event         text not null,  -- sent | viewed | signed | rejected | expired
  description   text,
  ip            text,
  user_agent    text,
  created_at    timestamptz default now()
);

create index if not exists digital_signatures_company_idx    on public.digital_signatures(company_id);
create index if not exists digital_signatures_employee_idx   on public.digital_signatures(employee_id);
create index if not exists digital_signatures_token_idx      on public.digital_signatures(token);
create index if not exists digital_signatures_status_idx     on public.digital_signatures(status);
create index if not exists sig_audit_trail_sig_id_idx        on public.signature_audit_trail(signature_id);

-- RLS assinaturas
alter table public.digital_signatures    enable row level security;
alter table public.signature_audit_trail enable row level security;

-- RH/gestor vê todos da empresa
create policy "signatures_rh_select" on public.digital_signatures
  for select using (
    company_id = public.my_company_id()
    and public.my_role() in ('adm_total', 'rh', 'gestor')
  );

create policy "signatures_rh_manage" on public.digital_signatures
  for all using (
    company_id = public.my_company_id()
    and public.my_role() in ('adm_total', 'rh')
  );

-- Colaborador só vê os seus
create policy "signatures_colab_select" on public.digital_signatures
  for select using (employee_id = public.my_employee_id());

create policy "signatures_colab_update" on public.digital_signatures
  for update using (employee_id = public.my_employee_id())
  with check (employee_id = public.my_employee_id());

-- Audit trail: RH vê tudo, colaborador vê os seus
create policy "sig_trail_select" on public.signature_audit_trail
  for select using (
    exists (
      select 1 from public.digital_signatures s
      where s.id = signature_id
        and (s.company_id = public.my_company_id() or s.employee_id = public.my_employee_id())
    )
  );

create policy "sig_trail_insert" on public.signature_audit_trail
  for insert with check (true);  -- inserção via trigger/API

-- ─── 5. manager_id em employees ──────────────────────────────
alter table public.employees
  add column if not exists manager_id uuid references public.employees(id) on delete set null;

create index if not exists employees_manager_idx on public.employees(manager_id);
