-- Advertências e ações disciplinares
create table if not exists public.employee_warnings (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  employee_id      uuid not null references public.employees(id) on delete cascade,
  type             text not null check (type in ('verbal','written','suspension','termination_cause')),
  severity         text not null check (severity in ('low','medium','high','critical')) default 'medium',
  description      text not null,
  occurrence_date  date not null,
  status           text not null check (status in ('pending','delivered','signed','refused')) default 'pending',
  response         text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists employee_warnings_company_idx on public.employee_warnings(company_id, occurrence_date desc);
create index if not exists employee_warnings_employee_idx on public.employee_warnings(employee_id);

alter table public.employee_warnings enable row level security;

-- RLS: adm_total e rh da empresa
create policy "employee_warnings_select" on public.employee_warnings
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = employee_warnings.company_id
        and p.role in ('adm_total', 'rh', 'gestor')
    )
  );

create policy "employee_warnings_insert" on public.employee_warnings
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = employee_warnings.company_id
        and p.role in ('adm_total', 'rh')
    )
  );

create policy "employee_warnings_update" on public.employee_warnings
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = employee_warnings.company_id
        and p.role in ('adm_total', 'rh')
    )
  );
