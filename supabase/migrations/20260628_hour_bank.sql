-- Tabela de lançamentos do banco de horas
create table if not exists public.hour_bank_entries (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  date         date not null,
  type         text not null check (type in ('credit', 'debit', 'compensated')),
  hours        numeric(6,2) not null check (hours > 0),
  description  text not null default '',
  created_by   uuid references public.profiles(id),
  created_at   timestamptz default now()
);

create index if not exists idx_hour_bank_entries_emp   on public.hour_bank_entries(employee_id, date desc);
create index if not exists idx_hour_bank_entries_co    on public.hour_bank_entries(company_id, date desc);

alter table public.hour_bank_entries enable row level security;

-- adm_total e rh: acesso total
create policy "hour_bank_rh_all" on public.hour_bank_entries
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('adm_total', 'rh', 'gestor')
  );

-- colaborador: só lê os próprios
create policy "hour_bank_colab_select" on public.hour_bank_entries
  for select using (
    employee_id in (select id from public.employees where profile_id = auth.uid())
  );
