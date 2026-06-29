-- Matriz de Competências
create table if not exists public.competencies (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  category    text not null default 'tecnica' check (category in ('tecnica','comportamental','lideranca','idioma')),
  description text,
  created_at  timestamptz default now()
);

create table if not exists public.employee_competencies (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  level         int  not null check (level between 1 and 5),  -- 1=básico 5=especialista
  notes         text,
  assessed_at   date not null default current_date,
  assessed_by   uuid references public.profiles(id),
  unique (employee_id, competency_id)
);

create index if not exists idx_competencies_co    on public.competencies(company_id);
create index if not exists idx_emp_comp_employee  on public.employee_competencies(employee_id);
create index if not exists idx_emp_comp_co        on public.employee_competencies(company_id);

alter table public.competencies          enable row level security;
alter table public.employee_competencies enable row level security;

create policy "competencies_company" on public.competencies
  for all using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "emp_competencies_company" on public.employee_competencies
  for all using (company_id = (select company_id from public.profiles where id = auth.uid()));
