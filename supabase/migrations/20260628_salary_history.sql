-- Histórico de reajustes salariais por colaborador
create table if not exists public.salary_history (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,
  salary         numeric(12,2) not null,
  effective_date date not null,
  reason         text,
  recorded_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Índice para consultas por colaborador
create index if not exists salary_history_employee_idx on public.salary_history(employee_id, effective_date desc);

-- RLS
alter table public.salary_history enable row level security;

-- Leitura: adm_total e rh da mesma empresa
create policy "salary_history_select" on public.salary_history
  for select using (
    exists (
      select 1 from public.employees e
      join public.profiles p on p.company_id = e.company_id
      where e.id = salary_history.employee_id
        and p.id = auth.uid()
        and p.role in ('adm_total', 'rh')
    )
  );

-- Inserção: adm_total e rh da mesma empresa
create policy "salary_history_insert" on public.salary_history
  for insert with check (
    exists (
      select 1 from public.employees e
      join public.profiles p on p.company_id = e.company_id
      where e.id = salary_history.employee_id
        and p.id = auth.uid()
        and p.role in ('adm_total', 'rh')
    )
  );
