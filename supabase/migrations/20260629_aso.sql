-- ASO — Atestado de Saúde Ocupacional (NR-7)
create table if not exists public.aso_records (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  type            text not null check (type in (
    'admissional','periodico','retorno_trabalho','mudanca_funcao','demissional'
  )),
  exam_date       date not null,
  next_exam_date  date,
  result          text not null default 'apto' check (result in ('apto','apto_restricoes','inapto')),
  doctor_name     text,
  crm             text,
  clinic          text,
  restrictions    text,
  notes           text,
  file_url        text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz default now()
);

create index if not exists idx_aso_co  on public.aso_records(company_id, exam_date desc);
create index if not exists idx_aso_emp on public.aso_records(employee_id, exam_date desc);

alter table public.aso_records enable row level security;

create policy "aso_company" on public.aso_records
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('adm_total','rh','gestor')
  );
