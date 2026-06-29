-- Controle de EPI (NR-6)
create table if not exists public.epi_items (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  name             text not null,
  ca_number        text,           -- Certificado de Aprovação MTE
  description      text,
  unit             text not null default 'unidade',
  stock            int  not null default 0,
  min_stock        int  not null default 0,
  validity_months  int,            -- validade em meses após entrega
  created_at       timestamptz default now()
);

create table if not exists public.epi_deliveries (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,
  epi_id        uuid not null references public.epi_items(id) on delete cascade,
  delivery_date date not null,
  quantity      int  not null default 1,
  expiry_date   date,
  return_date   date,
  condition     text check (condition in ('new','good','damaged','lost')) default 'new',
  notes         text,
  delivered_by  uuid references public.profiles(id),
  created_at    timestamptz default now()
);

create index if not exists idx_epi_items_co       on public.epi_items(company_id);
create index if not exists idx_epi_deliveries_emp on public.epi_deliveries(employee_id, delivery_date desc);
create index if not exists idx_epi_deliveries_co  on public.epi_deliveries(company_id, delivery_date desc);
create index if not exists idx_epi_deliveries_epi on public.epi_deliveries(epi_id);

alter table public.epi_items      enable row level security;
alter table public.epi_deliveries enable row level security;

create policy "epi_items_company" on public.epi_items
  for all using (company_id = (select company_id from public.profiles where id = auth.uid()));

create policy "epi_deliveries_company" on public.epi_deliveries
  for all using (company_id = (select company_id from public.profiles where id = auth.uid()));
