-- ============================================================
-- RH Control - Schema Inicial
-- ============================================================

-- Extensao para UUID
create extension if not exists "uuid-ossp";

-- ─── COMPANIES ────────────────────────────────────────────────
create table companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  cnpj        text,
  logo_url    text,
  plan        text not null default 'free' check (plan in ('free','starter','pro','enterprise')),
  status      text not null default 'active' check (status in ('active','inactive','suspended')),
  created_at  timestamptz not null default now()
);

-- ─── PROFILES ─────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  employee_id uuid,
  full_name   text not null,
  email       text not null,
  role        text not null default 'colaborador'
                check (role in ('adm_total','rh','gestor','colaborador')),
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── DEPARTMENTS ──────────────────────────────────────────────
create table departments (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  manager_id  uuid,
  parent_id   uuid references departments(id),
  created_at  timestamptz not null default now()
);

-- ─── POSITIONS ────────────────────────────────────────────────
create table positions (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  department_id uuid references departments(id),
  title         text not null,
  salary_min    numeric(12,2),
  salary_max    numeric(12,2),
  cbo_code      text,
  created_at    timestamptz not null default now()
);

-- ─── EMPLOYEES ────────────────────────────────────────────────
create table employees (
  id               uuid primary key default uuid_generate_v4(),
  company_id       uuid not null references companies(id) on delete cascade,
  profile_id       uuid references profiles(id),
  department_id    uuid references departments(id),
  position_id      uuid references positions(id),
  employee_code    text not null,
  full_name        text not null,
  cpf              text not null,
  rg               text,
  birth_date       date,
  hire_date        date not null,
  termination_date date,
  contract_type    text not null default 'clt'
                   check (contract_type in ('clt','pj','estagio','temporario')),
  salary           numeric(12,2) not null,
  bank_details     jsonb,
  address          jsonb,
  status           text not null default 'active'
                   check (status in ('active','inactive','on_leave','terminated')),
  email            text,
  phone            text,
  created_at       timestamptz not null default now(),
  unique (company_id, cpf),
  unique (company_id, employee_code)
);

-- FK manager em departments (criada apos employees existir)
alter table departments
  add constraint departments_manager_fk
  foreign key (manager_id) references employees(id);

-- ─── AUTO-INCREMENT employee_code por empresa ─────────────────
create sequence if not exists employee_code_seq;

create or replace function generate_employee_code()
returns trigger language plpgsql as $$
declare
  next_num int;
begin
  select coalesce(max(cast(regexp_replace(employee_code, '[^0-9]', '', 'g') as int)), 0) + 1
    into next_num
    from employees
   where company_id = NEW.company_id;
  NEW.employee_code := lpad(next_num::text, 5, '0');
  return NEW;
end;
$$;

create trigger trg_employee_code
  before insert on employees
  for each row
  when (NEW.employee_code = '' or NEW.employee_code is null)
  execute function generate_employee_code();

-- ─── ATTENDANCE ───────────────────────────────────────────────
create table attendance_records (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  date        date not null,
  clock_in    time,
  clock_out   time,
  lunch_start time,
  lunch_end   time,
  total_hours numeric(5,2),
  overtime    numeric(5,2),
  status      text not null default 'present'
              check (status in ('present','absent','late','half_day','holiday','vacation')),
  notes       text,
  unique (employee_id, date)
);

-- ─── VACATIONS ────────────────────────────────────────────────
create table vacations (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  days        int not null,
  status      text not null default 'pending'
              check (status in ('pending','approved','rejected','taken')),
  approved_by uuid references profiles(id),
  notes       text,
  created_at  timestamptz not null default now()
);

-- ─── PAYROLLS ─────────────────────────────────────────────────
create table payrolls (
  id               uuid primary key default uuid_generate_v4(),
  company_id       uuid not null references companies(id) on delete cascade,
  reference_month  text not null,
  status           text not null default 'open'
                   check (status in ('open','processing','closed')),
  total_gross      numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  total_net        numeric(14,2) not null default 0,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  unique (company_id, reference_month)
);

create table payroll_items (
  id               uuid primary key default uuid_generate_v4(),
  payroll_id       uuid not null references payrolls(id) on delete cascade,
  employee_id      uuid not null references employees(id),
  gross_salary     numeric(12,2) not null,
  inss             numeric(12,2) not null default 0,
  irrf             numeric(12,2) not null default 0,
  fgts             numeric(12,2) not null default 0,
  other_discounts  jsonb,
  other_additions  jsonb,
  net_salary       numeric(12,2) not null
);

-- ─── DOCUMENTS ────────────────────────────────────────────────
create table documents (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  type        text not null
              check (type in ('cpf','rg','ctps','pis','contrato','admissao',
                              'demissao','ferias','atestado','outro')),
  name        text not null,
  file_url    text not null,
  expires_at  date,
  created_at  timestamptz not null default now()
);

-- ─── RECRUITMENT ──────────────────────────────────────────────
create table job_openings (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references companies(id) on delete cascade,
  position_id  uuid references positions(id),
  title        text not null,
  description  text,
  requirements text,
  status       text not null default 'open'
               check (status in ('open','paused','closed')),
  open_date    date not null default current_date,
  close_date   date,
  created_at   timestamptz not null default now()
);

create table candidates (
  id             uuid primary key default uuid_generate_v4(),
  job_opening_id uuid not null references job_openings(id) on delete cascade,
  name           text not null,
  email          text not null,
  phone          text,
  resume_url     text,
  stage          text not null default 'applied'
                 check (stage in ('applied','screening','interview','offer','hired','rejected')),
  notes          text,
  created_at     timestamptz not null default now()
);

-- ─── PERFORMANCE ──────────────────────────────────────────────
create table performance_reviews (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  period      text not null,
  score       numeric(3,1) check (score >= 1 and score <= 5),
  feedback    text,
  goals       jsonb,
  status      text not null default 'draft'
              check (status in ('draft','submitted','acknowledged')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table companies           enable row level security;
alter table profiles            enable row level security;
alter table departments         enable row level security;
alter table positions           enable row level security;
alter table employees           enable row level security;
alter table attendance_records  enable row level security;
alter table vacations           enable row level security;
alter table payrolls            enable row level security;
alter table payroll_items       enable row level security;
alter table documents           enable row level security;
alter table job_openings        enable row level security;
alter table candidates          enable row level security;
alter table performance_reviews enable row level security;

-- Helper: company_id do usuario autenticado
create or replace function auth.company_id()
returns uuid language sql stable security definer
as $$
  select company_id from profiles where id = auth.uid()
$$;

-- Helper: role do usuario autenticado
create or replace function auth.user_role()
returns text language sql stable security definer
as $$
  select role from profiles where id = auth.uid()
$$;

-- ─── Policies: Companies ──────────────────────────────────────
create policy "Usuario ve sua empresa"
  on companies for select
  using (id = auth.company_id());

create policy "ADM pode atualizar empresa"
  on companies for update
  using (id = auth.company_id() and auth.user_role() = 'adm_total');

-- ─── Policies: Profiles ───────────────────────────────────────
create policy "Usuario ve perfis da sua empresa"
  on profiles for select
  using (company_id = auth.company_id());

create policy "Usuario pode atualizar o proprio perfil"
  on profiles for update
  using (id = auth.uid());

create policy "RH/ADM pode criar perfis na empresa"
  on profiles for insert
  with check (
    company_id = auth.company_id()
    and auth.user_role() in ('adm_total', 'rh')
  );

create policy "ADM pode alterar papel de membros"
  on profiles for update
  using (
    company_id = auth.company_id()
    and auth.user_role() = 'adm_total'
  );

-- ─── Policies: Employees ──────────────────────────────────────
create policy "Colaborador da empresa pode ver funcionarios"
  on employees for select
  using (company_id = auth.company_id());

create policy "RH/ADM pode inserir funcionarios"
  on employees for insert
  with check (
    company_id = auth.company_id()
    and auth.user_role() in ('adm_total', 'rh')
  );

create policy "RH/ADM pode atualizar funcionarios"
  on employees for update
  using (
    company_id = auth.company_id()
    and auth.user_role() in ('adm_total', 'rh')
  );

create policy "RH/ADM pode excluir funcionarios"
  on employees for delete
  using (
    company_id = auth.company_id()
    and auth.user_role() in ('adm_total', 'rh')
  );

-- ─── Policies: tabelas restantes (acesso por empresa) ─────────
create policy "Acesso por empresa - departments"
  on departments for all
  using (company_id = auth.company_id());

create policy "Acesso por empresa - positions"
  on positions for all
  using (company_id = auth.company_id());

create policy "Acesso por empresa - attendance"
  on attendance_records for all
  using (company_id = auth.company_id());

create policy "Acesso por empresa - vacations"
  on vacations for all
  using (company_id = auth.company_id());

create policy "Acesso por empresa - payrolls"
  on payrolls for all
  using (company_id = auth.company_id());

create policy "Acesso por empresa - payroll_items"
  on payroll_items for all
  using (
    payroll_id in (select id from payrolls where company_id = auth.company_id())
  );

create policy "Acesso por empresa - documents"
  on documents for all
  using (company_id = auth.company_id());

create policy "Acesso por empresa - job_openings"
  on job_openings for all
  using (company_id = auth.company_id());

create policy "Acesso por empresa - candidates"
  on candidates for all
  using (
    job_opening_id in (select id from job_openings where company_id = auth.company_id())
  );

create policy "Acesso por empresa - performance_reviews"
  on performance_reviews for all
  using (company_id = auth.company_id());

-- ============================================================
-- TRIGGER: cria profile automaticamente apos signup
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- Insere profile somente se company_id estiver nos metadados
  if (NEW.raw_user_meta_data->>'company_id') is not null then
    insert into profiles (id, company_id, full_name, email, role)
    values (
      NEW.id,
      (NEW.raw_user_meta_data->>'company_id')::uuid,
      coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email,
      coalesce(NEW.raw_user_meta_data->>'role', 'colaborador')
    );
  end if;
  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
