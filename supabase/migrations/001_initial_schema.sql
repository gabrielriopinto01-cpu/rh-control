-- ============================================================
-- RH Control — Schema Inicial
-- Execute inteiro no SQL Editor do Supabase
-- ============================================================

-- Extensão para UUID
create extension if not exists "uuid-ossp";

-- ─── COMPANIES ────────────────────────────────────────────────
create table if not exists companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  cnpj        text,
  logo_url    text,
  plan        text not null default 'free'
              check (plan in ('free','starter','pro','enterprise')),
  status      text not null default 'active'
              check (status in ('active','inactive','suspended')),
  created_at  timestamptz not null default now()
);

-- ─── PROFILES ─────────────────────────────────────────────────
create table if not exists profiles (
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
create table if not exists departments (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  manager_id  uuid,
  parent_id   uuid references departments(id),
  created_at  timestamptz not null default now()
);

-- ─── POSITIONS ────────────────────────────────────────────────
create table if not exists positions (
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
create table if not exists employees (
  id               uuid primary key default uuid_generate_v4(),
  company_id       uuid not null references companies(id) on delete cascade,
  profile_id       uuid references profiles(id),
  department_id    uuid references departments(id),
  position_id      uuid references positions(id),
  employee_code    text not null default '',
  full_name        text not null,
  cpf              text not null,
  rg               text,
  birth_date       date,
  hire_date        date not null,
  termination_date date,
  contract_type    text not null default 'clt'
                   check (contract_type in ('clt','pj','estagio','temporario')),
  salary           numeric(12,2) not null,
  email            text,
  phone            text,
  avatar_url       text,
  bank_details     jsonb,
  address          jsonb,
  status           text not null default 'active'
                   check (status in ('active','inactive','on_leave','terminated')),
  created_at       timestamptz not null default now(),
  unique (company_id, cpf),
  unique (company_id, employee_code)
);

-- FK manager em departments (criada após employees existir)
alter table departments
  drop constraint if exists departments_manager_fk;
alter table departments
  add constraint departments_manager_fk
  foreign key (manager_id) references employees(id);

-- Auto-increment employee_code por empresa
create or replace function generate_employee_code()
returns trigger language plpgsql as $$
declare
  next_num int;
begin
  select coalesce(
    max(cast(regexp_replace(employee_code, '[^0-9]', '', 'g') as int)), 0
  ) + 1
    into next_num
    from employees
   where company_id = NEW.company_id;
  NEW.employee_code := lpad(next_num::text, 5, '0');
  return NEW;
end;
$$;

drop trigger if exists trg_employee_code on employees;
create trigger trg_employee_code
  before insert on employees
  for each row
  when (NEW.employee_code = '' or NEW.employee_code is null)
  execute function generate_employee_code();

-- ─── ATTENDANCE ───────────────────────────────────────────────
create table if not exists attendance_records (
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
create table if not exists vacations (
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
create table if not exists payrolls (
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

create table if not exists payroll_items (
  id              uuid primary key default uuid_generate_v4(),
  payroll_id      uuid not null references payrolls(id) on delete cascade,
  employee_id     uuid not null references employees(id),
  gross_salary    numeric(12,2) not null,
  inss            numeric(12,2) not null default 0,
  irrf            numeric(12,2) not null default 0,
  fgts            numeric(12,2) not null default 0,
  other_discounts jsonb,
  other_additions jsonb,
  net_salary      numeric(12,2) not null
);

-- ─── DOCUMENTS ────────────────────────────────────────────────
create table if not exists documents (
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
create table if not exists job_openings (
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

create table if not exists candidates (
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
create table if not exists performance_reviews (
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
-- HELPER FUNCTIONS (public schema — auth schema bloqueado no Editor)
-- ============================================================

create or replace function public.my_company_id()
returns uuid language sql stable security definer
as $$
  select company_id from profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns text language sql stable security definer
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.my_employee_id()
returns uuid language sql stable security definer
as $$
  select id from employees
   where company_id = public.my_company_id()
     and (profile_id = auth.uid()
       or email = (select email from profiles where id = auth.uid()))
   limit 1
$$;

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

-- ─── Companies ────────────────────────────────────────────────
create policy "Ver própria empresa"
  on companies for select
  using (id = public.my_company_id());

create policy "ADM atualiza empresa"
  on companies for update
  using (id = public.my_company_id() and public.my_role() = 'adm_total');

-- ─── Profiles ─────────────────────────────────────────────────
create policy "Ver perfis da empresa"
  on profiles for select
  using (company_id = public.my_company_id());

create policy "Atualizar próprio perfil"
  on profiles for update
  using (id = auth.uid());

create policy "ADM/RH atualiza qualquer perfil da empresa"
  on profiles for update
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh'));

create policy "Inserir perfil na empresa"
  on profiles for insert
  with check (company_id = public.my_company_id());

-- ─── Departments ──────────────────────────────────────────────
create policy "Acesso departamentos da empresa"
  on departments for all
  using (company_id = public.my_company_id());

-- ─── Positions ────────────────────────────────────────────────
create policy "Acesso cargos da empresa"
  on positions for all
  using (company_id = public.my_company_id());

-- ─── Employees ────────────────────────────────────────────────
create policy "Ver funcionários da empresa"
  on employees for select
  using (company_id = public.my_company_id());

create policy "RH/ADM insere funcionário"
  on employees for insert
  with check (company_id = public.my_company_id()
              and public.my_role() in ('adm_total','rh'));

create policy "RH/ADM atualiza funcionário"
  on employees for update
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh'));

create policy "Colaborador atualiza próprio registro"
  on employees for update
  using (id = public.my_employee_id());

create policy "RH/ADM exclui funcionário"
  on employees for delete
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh'));

-- ─── Attendance ───────────────────────────────────────────────
create policy "RH/Gestor vê ponto da empresa"
  on attendance_records for select
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh','gestor'));

create policy "Colaborador vê próprio ponto"
  on attendance_records for select
  using (employee_id = public.my_employee_id());

create policy "RH/Gestor gerencia ponto"
  on attendance_records for insert
  with check (company_id = public.my_company_id()
              and public.my_role() in ('adm_total','rh','gestor'));

create policy "Colaborador registra próprio ponto"
  on attendance_records for insert
  with check (employee_id = public.my_employee_id()
              and company_id = public.my_company_id());

create policy "RH/Gestor atualiza ponto"
  on attendance_records for update
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh','gestor'));

create policy "Colaborador atualiza próprio ponto"
  on attendance_records for update
  using (employee_id = public.my_employee_id());

create policy "RH exclui ponto"
  on attendance_records for delete
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh'));

-- ─── Vacations ────────────────────────────────────────────────
create policy "RH/Gestor vê férias da empresa"
  on vacations for select
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh','gestor'));

create policy "Colaborador vê próprias férias"
  on vacations for select
  using (employee_id = public.my_employee_id());

create policy "Qualquer um pode solicitar férias na empresa"
  on vacations for insert
  with check (company_id = public.my_company_id());

create policy "RH/Gestor atualiza férias"
  on vacations for update
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh','gestor'));

create policy "RH exclui férias"
  on vacations for delete
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh'));

-- ─── Payrolls ─────────────────────────────────────────────────
create policy "RH/ADM vê folhas"
  on payrolls for select
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh'));

create policy "RH/ADM gerencia folhas"
  on payrolls for insert
  with check (company_id = public.my_company_id()
              and public.my_role() in ('adm_total','rh'));

create policy "RH/ADM atualiza folhas"
  on payrolls for update
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh'));

-- ─── Payroll Items ────────────────────────────────────────────
create policy "RH/ADM vê itens da folha"
  on payroll_items for select
  using (payroll_id in (
    select id from payrolls
     where company_id = public.my_company_id()
       and public.my_role() in ('adm_total','rh')
  ));

create policy "Colaborador vê próprio holerite"
  on payroll_items for select
  using (employee_id = public.my_employee_id());

create policy "RH/ADM gerencia itens da folha"
  on payroll_items for insert
  with check (payroll_id in (
    select id from payrolls where company_id = public.my_company_id()
  ) and public.my_role() in ('adm_total','rh'));

create policy "RH/ADM atualiza itens da folha"
  on payroll_items for update
  using (payroll_id in (
    select id from payrolls where company_id = public.my_company_id()
  ) and public.my_role() in ('adm_total','rh'));

-- ─── Documents ────────────────────────────────────────────────
create policy "RH/Gestor vê documentos da empresa"
  on documents for select
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh','gestor'));

create policy "Colaborador vê próprios documentos"
  on documents for select
  using (employee_id = public.my_employee_id());

create policy "RH gerencia documentos"
  on documents for insert
  with check (company_id = public.my_company_id()
              and public.my_role() in ('adm_total','rh'));

create policy "RH atualiza documentos"
  on documents for update
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh'));

create policy "RH exclui documentos"
  on documents for delete
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh'));

-- ─── Recruitment ──────────────────────────────────────────────
create policy "Acesso vagas da empresa"
  on job_openings for all
  using (company_id = public.my_company_id());

create policy "Acesso candidatos da empresa"
  on candidates for all
  using (job_opening_id in (
    select id from job_openings where company_id = public.my_company_id()
  ));

-- ─── Performance ──────────────────────────────────────────────
create policy "RH/Gestor vê avaliações"
  on performance_reviews for select
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh','gestor'));

create policy "Colaborador vê própria avaliação"
  on performance_reviews for select
  using (employee_id = public.my_employee_id());

create policy "RH/Gestor gerencia avaliações"
  on performance_reviews for all
  using (company_id = public.my_company_id()
         and public.my_role() in ('adm_total','rh','gestor'));

-- ============================================================
-- TRIGGER: cria profile automaticamente após signup
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  if (NEW.raw_user_meta_data->>'company_id') is not null then
    insert into profiles (id, company_id, full_name, email, role)
    values (
      NEW.id,
      (NEW.raw_user_meta_data->>'company_id')::uuid,
      coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
      NEW.email,
      coalesce(NEW.raw_user_meta_data->>'role', 'colaborador')
    )
    on conflict (id) do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- STORAGE: bucket para documentos e fotos
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', true)
  on conflict (id) do nothing;

create policy "Qualquer autenticado pode ler"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "Autenticado pode fazer upload"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "Autenticado pode atualizar próprio arquivo"
  on storage.objects for update
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "RH/ADM pode excluir arquivos"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.role() = 'authenticated');
