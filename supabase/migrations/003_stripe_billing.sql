-- ============================================================
-- Migration 003: Stripe Billing
-- ============================================================

-- Adiciona colunas de billing na tabela companies
alter table public.companies
  add column if not exists plan                  text default 'free',
  add column if not exists plan_status           text default 'inactive',
  add column if not exists stripe_customer_id    text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists plan_expires_at       timestamptz,
  add column if not exists cnpj                  text;

-- Index para lookup por customer_id
create index if not exists companies_stripe_customer_idx
  on public.companies(stripe_customer_id)
  where stripe_customer_id is not null;

-- View de limites por plano (usada no frontend para enforcement)
create or replace view public.plan_limits as
select
  c.id as company_id,
  c.plan,
  c.plan_status,
  case c.plan
    when 'starter'      then 10
    when 'professional' then 50
    when 'enterprise'   then 9999
    else 3  -- free tier
  end as max_employees,
  case c.plan
    when 'starter'      then 3
    when 'professional' then 20
    when 'enterprise'   then 9999
    else 1  -- free tier
  end as max_departments,
  (select count(*) from public.employees e
    where e.company_id = c.id and e.status = 'active') as current_employees,
  (select count(*) from public.departments d
    where d.company_id = c.id) as current_departments
from public.companies c;

-- RLS na view
grant select on public.plan_limits to authenticated;

-- Função para checar se empresa pode adicionar colaborador
create or replace function public.can_add_employee() returns boolean
  language sql security definer stable as $$
    select coalesce(
      (select current_employees < max_employees
       from public.plan_limits
       where company_id = public.my_company_id()),
      false
    );
  $$;
