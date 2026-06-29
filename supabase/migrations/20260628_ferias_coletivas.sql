-- Férias Coletivas (CLT Art. 139)
create table if not exists public.collective_vacations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  title        text not null,
  start_date   date not null,
  end_date     date not null,
  days         int  not null,
  scope        text not null default 'all' check (scope in ('all','department')),
  department_id uuid references public.departments(id) on delete set null,
  notes        text,
  status       text not null default 'planned' check (status in ('planned','active','completed','cancelled')),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz default now()
);

create index if not exists idx_collective_vac_co on public.collective_vacations(company_id, start_date desc);

alter table public.collective_vacations enable row level security;

create policy "collective_vac_company" on public.collective_vacations
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('adm_total','rh')
  );
