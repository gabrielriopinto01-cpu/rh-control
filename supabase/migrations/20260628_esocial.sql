-- Registro de eventos e-Social
create table if not exists public.esocial_events (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  tipo          text not null,        -- ex: S-2200
  descricao     text not null,
  employee_id   uuid references public.employees(id) on delete set null,
  employee_name text,
  data_evento   date not null,
  data_envio    date,
  status        text not null default 'pendente'
    check (status in ('pendente','enviado','processado','erro','retificado')),
  protocolo     text,
  observacao    text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now()
);

create index if not exists idx_esocial_events_co  on public.esocial_events(company_id, data_evento desc);
create index if not exists idx_esocial_events_emp on public.esocial_events(employee_id);

alter table public.esocial_events enable row level security;

create policy "esocial_company" on public.esocial_events
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('adm_total', 'rh')
  );
