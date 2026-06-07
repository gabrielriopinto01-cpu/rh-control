-- ============================================================
-- Migration 002: Audit Log
-- ============================================================

create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  user_email   text,
  user_role    text,
  action       text not null,        -- CREATE, UPDATE, DELETE, LOGIN, etc.
  resource     text not null,        -- employees, payroll, vacations, etc.
  resource_id  text,
  description  text,
  metadata     jsonb,
  ip_address   text,
  created_at   timestamptz default now()
);

-- Index para queries comuns
create index if not exists audit_logs_company_id_idx  on public.audit_logs(company_id);
create index if not exists audit_logs_created_at_idx  on public.audit_logs(created_at desc);
create index if not exists audit_logs_user_id_idx     on public.audit_logs(user_id);
create index if not exists audit_logs_resource_idx    on public.audit_logs(resource);

-- RLS
alter table public.audit_logs enable row level security;

-- Apenas adm_total e rh podem ver logs
create policy "audit_logs_select" on public.audit_logs
  for select using (
    company_id = public.my_company_id()
    and public.my_role() in ('adm_total', 'rh')
  );

-- Insert aberto para service_role via API route / trigger
create policy "audit_logs_insert" on public.audit_logs
  for insert with check (company_id = public.my_company_id());

-- Função helper para inserir log facilmente
create or replace function public.log_audit(
  p_action      text,
  p_resource    text,
  p_resource_id text default null,
  p_description text default null,
  p_metadata    jsonb default null
) returns void language plpgsql security definer as $$
begin
  insert into public.audit_logs(
    company_id, user_id, user_email, user_role,
    action, resource, resource_id, description, metadata
  )
  values (
    public.my_company_id(),
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    public.my_role(),
    p_action, p_resource, p_resource_id, p_description, p_metadata
  );
end;
$$;

-- Trigger automático em employees
create or replace function public.audit_employees_trigger() returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    perform public.log_audit('CREATE', 'employees', NEW.id::text,
      'Colaborador criado: ' || NEW.full_name,
      jsonb_build_object('full_name', NEW.full_name, 'position', NEW.position)
    );
  elsif TG_OP = 'UPDATE' then
    perform public.log_audit('UPDATE', 'employees', NEW.id::text,
      'Colaborador atualizado: ' || NEW.full_name, null
    );
  elsif TG_OP = 'DELETE' then
    perform public.log_audit('DELETE', 'employees', OLD.id::text,
      'Colaborador removido: ' || OLD.full_name, null
    );
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists audit_employees on public.employees;
create trigger audit_employees
  after insert or update or delete on public.employees
  for each row execute function public.audit_employees_trigger();

-- Trigger automático em payroll_runs
create or replace function public.audit_payroll_trigger() returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    perform public.log_audit('CREATE', 'payroll_runs', NEW.id::text,
      'Folha criada: ' || NEW.ref_month, null);
  elsif TG_OP = 'UPDATE' then
    perform public.log_audit('UPDATE', 'payroll_runs', NEW.id::text,
      'Folha atualizada: ' || NEW.ref_month || ' → status: ' || NEW.status, null);
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists audit_payroll on public.payroll_runs;
create trigger audit_payroll
  after insert or update on public.payroll_runs
  for each row execute function public.audit_payroll_trigger();
