-- Histórico Funcional — promoções, transferências, mudanças de cargo/salário
create table if not exists public.functional_history (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  event_type      text not null check (event_type in (
    'admission','promotion','demotion','transfer','salary_change',
    'position_change','contract_change','warning','commendation','other'
  )),
  event_date      date not null,
  title           text not null,
  description     text,
  from_position   text,
  to_position     text,
  from_department text,
  to_department   text,
  from_salary     numeric(12,2),
  to_salary       numeric(12,2),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz default now()
);

create index if not exists idx_func_hist_co  on public.functional_history(company_id, event_date desc);
create index if not exists idx_func_hist_emp on public.functional_history(employee_id, event_date desc);

alter table public.functional_history enable row level security;

create policy "func_hist_company" on public.functional_history
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('adm_total','rh','gestor')
  );
