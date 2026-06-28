-- Turnos de trabalho
create table if not exists public.work_shifts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  name          text not null,
  start_time    time not null,
  end_time      time not null,
  color         text not null default '#3b82f6',
  days_of_week  int[] not null default '{1,2,3,4,5}',  -- 0=dom … 6=sáb
  created_at    timestamptz default now()
);

-- Atribuições de escala (colaborador × turno × período)
create table if not exists public.shift_assignments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  shift_id    uuid not null references public.work_shifts(id) on delete cascade,
  start_date  date not null,
  end_date    date,
  created_at  timestamptz default now()
);

create index if not exists idx_shift_assignments_emp on public.shift_assignments(employee_id, start_date);
create index if not exists idx_shift_assignments_co  on public.shift_assignments(company_id, start_date);

alter table public.work_shifts       enable row level security;
alter table public.shift_assignments enable row level security;

create policy "work_shifts_company" on public.work_shifts
  for all using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "shift_assignments_company" on public.shift_assignments
  for all using (company_id = (select company_id from public.profiles where id = auth.uid()));
