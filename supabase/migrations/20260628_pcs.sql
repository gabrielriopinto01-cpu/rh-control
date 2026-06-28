-- Plano de Cargos e Salários
create table if not exists public.salary_bands (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  position_id  uuid not null references public.positions(id) on delete cascade,
  level        text not null check (level in ('junior','pleno','senior','especialista','coordenador','gerente','diretor')),
  min_salary   numeric(12,2) not null,
  mid_salary   numeric(12,2),
  max_salary   numeric(12,2) not null,
  created_at   timestamptz default now(),
  unique (company_id, position_id, level)
);

create index if not exists idx_salary_bands_pos on public.salary_bands(position_id);

alter table public.salary_bands enable row level security;

create policy "salary_bands_company" on public.salary_bands
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('adm_total','rh')
  );
