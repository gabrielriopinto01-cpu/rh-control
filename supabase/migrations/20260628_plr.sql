-- PLR — Participação nos Lucros e Resultados (Lei 10.101/2000)
create table if not exists public.plr_programs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null,
  reference    text not null,   -- ex: "2026-S1", "2026"
  total_pool   numeric(14,2),   -- valor total do pool
  status       text not null default 'draft'
    check (status in ('draft','approved','paid')),
  payment_date date,
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz default now()
);

create table if not exists public.plr_items (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.plr_programs(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  base_salary  numeric(12,2) not null,
  months_worked int not null default 12,
  factor       numeric(5,4) not null default 1.0,  -- multiplicador individual (metas)
  gross_amount numeric(12,2) not null,
  ir_withheld  numeric(12,2) not null default 0,
  net_amount   numeric(12,2) not null,
  paid         boolean not null default false,
  created_at   timestamptz default now()
);

create index if not exists idx_plr_programs_co on public.plr_programs(company_id, created_at desc);
create index if not exists idx_plr_items_prog  on public.plr_items(program_id);
create index if not exists idx_plr_items_emp   on public.plr_items(employee_id);

alter table public.plr_programs enable row level security;
alter table public.plr_items    enable row level security;

create policy "plr_programs_company" on public.plr_programs
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('adm_total','rh')
  );

create policy "plr_items_via_program" on public.plr_items
  for all using (
    exists (
      select 1 from public.plr_programs p
      where p.id = plr_items.program_id
        and p.company_id = (select company_id from public.profiles where id = auth.uid())
    )
    and (select role from public.profiles where id = auth.uid()) in ('adm_total','rh')
  );
