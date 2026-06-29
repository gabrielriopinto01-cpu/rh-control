-- Portal de Solicitações (colaborador → RH/gestor)
create table if not exists public.employee_requests (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  type         text not null check (type in (
    'vacation','time_adjustment','document','advance','benefit_change',
    'transfer','remote_work','training','other'
  )),
  title        text not null,
  description  text not null,
  status       text not null default 'pending'
    check (status in ('pending','in_review','approved','rejected','cancelled')),
  priority     text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  start_date   date,
  end_date     date,
  response     text,
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz default now()
);

create index if not exists idx_emp_requests_co  on public.employee_requests(company_id, created_at desc);
create index if not exists idx_emp_requests_emp on public.employee_requests(employee_id, created_at desc);

alter table public.employee_requests enable row level security;

-- RH/gestor vê todas da empresa
create policy "requests_rh_all" on public.employee_requests
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('adm_total','rh','gestor')
  );

-- Colaborador vê e cria as próprias
create policy "requests_colab_own" on public.employee_requests
  for all using (
    employee_id in (select id from public.employees where profile_id = auth.uid())
  );
