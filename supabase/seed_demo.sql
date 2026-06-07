-- ============================================================
-- RH Control — Seed de Demonstração Comercial
-- Execute APÓS as migrations 001, 002, 003, 004
-- Cria uma empresa demo completa para apresentações
-- ============================================================

-- ATENÇÃO: Substitua 'COMPANY_ID_AQUI' pelo UUID real da empresa
-- criada após o primeiro registro no sistema.

-- Para usar: registre uma conta em /register, copie o company_id
-- da tabela companies e substitua abaixo, então execute este SQL.

do $$
declare
  v_company_id  uuid := 'COMPANY_ID_AQUI';  -- << substitua aqui
  v_dept_rh     uuid;
  v_dept_ti     uuid;
  v_dept_fin    uuid;
  v_dept_ops    uuid;
  v_pos_analista uuid;
  v_pos_dev     uuid;
  v_pos_gestor  uuid;
  v_pos_assist  uuid;
  v_emp_1       uuid;
  v_emp_2       uuid;
  v_emp_3       uuid;
  v_emp_4       uuid;
  v_emp_5       uuid;
  v_emp_6       uuid;
  v_payroll_id  uuid;
begin

-- ─── Departamentos ───────────────────────────────────────────
insert into public.departments (id, company_id, name) values
  (gen_random_uuid(), v_company_id, 'Recursos Humanos'),
  (gen_random_uuid(), v_company_id, 'Tecnologia'),
  (gen_random_uuid(), v_company_id, 'Financeiro'),
  (gen_random_uuid(), v_company_id, 'Operações')
returning id into v_dept_rh;

select id into v_dept_rh  from public.departments where company_id = v_company_id and name = 'Recursos Humanos' limit 1;
select id into v_dept_ti  from public.departments where company_id = v_company_id and name = 'Tecnologia'       limit 1;
select id into v_dept_fin from public.departments where company_id = v_company_id and name = 'Financeiro'       limit 1;
select id into v_dept_ops from public.departments where company_id = v_company_id and name = 'Operações'        limit 1;

-- ─── Cargos ──────────────────────────────────────────────────
insert into public.positions (id, company_id, title, department_id, salary_min, salary_max) values
  (gen_random_uuid(), v_company_id, 'Analista de RH',         v_dept_rh,  3500, 6000),
  (gen_random_uuid(), v_company_id, 'Desenvolvedor Full Stack',v_dept_ti,  6000, 12000),
  (gen_random_uuid(), v_company_id, 'Gestor de TI',           v_dept_ti,  10000, 18000),
  (gen_random_uuid(), v_company_id, 'Assistente Financeiro',  v_dept_fin, 2800, 4500);

select id into v_pos_analista from public.positions where company_id = v_company_id and title = 'Analista de RH'          limit 1;
select id into v_pos_dev      from public.positions where company_id = v_company_id and title = 'Desenvolvedor Full Stack' limit 1;
select id into v_pos_gestor   from public.positions where company_id = v_company_id and title = 'Gestor de TI'            limit 1;
select id into v_pos_assist   from public.positions where company_id = v_company_id and title = 'Assistente Financeiro'   limit 1;

-- ─── Colaboradores ───────────────────────────────────────────
insert into public.employees (id, company_id, full_name, email, cpf, position, department_id, base_salary, hire_date, birth_date, status, phone) values
  (gen_random_uuid(), v_company_id, 'Mariana Costa',     'mariana.costa@demo.com',     '111.111.111-11', 'Analista de RH',          v_dept_rh,  4500,  '2022-03-15', '1992-08-14', 'active', '(11) 99111-1111'),
  (gen_random_uuid(), v_company_id, 'Rafael Oliveira',   'rafael.oliveira@demo.com',   '222.222.222-22', 'Desenvolvedor Full Stack', v_dept_ti,  8500,  '2021-06-01', '1990-03-22', 'active', '(11) 99222-2222'),
  (gen_random_uuid(), v_company_id, 'Juliana Souza',     'juliana.souza@demo.com',     '333.333.333-33', 'Gestor de TI',            v_dept_ti,  13000, '2020-01-10', '1985-11-30', 'active', '(11) 99333-3333'),
  (gen_random_uuid(), v_company_id, 'Pedro Almeida',     'pedro.almeida@demo.com',     '444.444.444-44', 'Desenvolvedor Full Stack', v_dept_ti,  7200,  '2023-02-20', '1995-06-18', 'active', '(11) 99444-4444'),
  (gen_random_uuid(), v_company_id, 'Fernanda Lima',     'fernanda.lima@demo.com',     '555.555.555-55', 'Assistente Financeiro',   v_dept_fin, 3200,  '2022-09-05', '1994-01-07', 'active', '(11) 99555-5555'),
  (gen_random_uuid(), v_company_id, 'Carlos Mendes',     'carlos.mendes@demo.com',     '666.666.666-66', 'Analista de RH',          v_dept_rh,  4800,  '2021-11-15', '1988-09-25', 'active', '(11) 99666-6666');

select id into v_emp_1 from public.employees where company_id = v_company_id and full_name = 'Mariana Costa'   limit 1;
select id into v_emp_2 from public.employees where company_id = v_company_id and full_name = 'Rafael Oliveira' limit 1;
select id into v_emp_3 from public.employees where company_id = v_company_id and full_name = 'Juliana Souza'   limit 1;
select id into v_emp_4 from public.employees where company_id = v_company_id and full_name = 'Pedro Almeida'   limit 1;
select id into v_emp_5 from public.employees where company_id = v_company_id and full_name = 'Fernanda Lima'   limit 1;
select id into v_emp_6 from public.employees where company_id = v_company_id and full_name = 'Carlos Mendes'   limit 1;

-- Define gestor de TI como manager dos devs
update public.employees set manager_id = v_emp_3 where id in (v_emp_2, v_emp_4) and company_id = v_company_id;

-- ─── Registros de Ponto (último mês) ─────────────────────────
insert into public.attendance (company_id, employee_id, date, type, clock_in, clock_out, total_hours, overtime) values
  (v_company_id, v_emp_1, current_date - 4, 'work', '08:02:00', '17:15:00', 9.22, 1.22),
  (v_company_id, v_emp_1, current_date - 3, 'work', '08:00:00', '17:00:00', 9.00, 1.00),
  (v_company_id, v_emp_1, current_date - 2, 'work', '07:55:00', '17:05:00', 9.17, 1.17),
  (v_company_id, v_emp_2, current_date - 4, 'work', '09:10:00', '18:30:00', 9.33, 1.33),
  (v_company_id, v_emp_2, current_date - 3, 'work', '09:00:00', '19:00:00', 10.00, 2.00),
  (v_company_id, v_emp_3, current_date - 4, 'work', '08:30:00', '17:30:00', 9.00, 1.00),
  (v_company_id, v_emp_4, current_date - 2, 'absence', null, null, 0, 0),
  (v_company_id, v_emp_5, current_date - 4, 'work', '08:00:00', '17:00:00', 9.00, 1.00),
  (v_company_id, v_emp_5, current_date - 3, 'work', '08:05:00', '17:10:00', 9.08, 1.08);

-- ─── Férias ──────────────────────────────────────────────────
insert into public.vacations (company_id, employee_id, start_date, end_date, days, status, notes) values
  (v_company_id, v_emp_1, current_date + 15, current_date + 44, 30, 'approved', 'Férias anuais aprovadas'),
  (v_company_id, v_emp_5, current_date + 5,  current_date + 19, 15, 'pending',  'Solicitação pendente de aprovação'),
  (v_company_id, v_emp_6, current_date - 30, current_date - 1,  30, 'approved', 'Férias já realizadas');

-- ─── Folha de Pagamento ───────────────────────────────────────
insert into public.payroll_runs (id, company_id, ref_month, status) values
  (gen_random_uuid(), v_company_id, to_char(current_date, 'YYYY-MM'), 'closed');

select id into v_payroll_id from public.payroll_runs where company_id = v_company_id limit 1;

insert into public.payroll_items (
  company_id, payroll_run_id, employee_id,
  base_salary, inss_deduction, irrf_deduction, fgts, net_salary, other_additions, other_discounts
) values
  (v_company_id, v_payroll_id, v_emp_1, 4500,  405,  168.75, 360,  3926.25, '[]', '[]'),
  (v_company_id, v_payroll_id, v_emp_2, 8500,  1190, 892.50, 680,  6417.50,
    '[{"descricao":"Horas extras","valor":450}]', '[]'),
  (v_company_id, v_payroll_id, v_emp_3, 13000, 1820, 2047.50,1040, 9132.50, '[]', '[]'),
  (v_company_id, v_payroll_id, v_emp_4, 7200,  1008, 654.00, 576,  5538.00, '[]',
    '[{"descricao":"Desconto falta","valor":280}]'),
  (v_company_id, v_payroll_id, v_emp_5, 3200,  288,  60.00,  256,  2852.00, '[]', '[]'),
  (v_company_id, v_payroll_id, v_emp_6, 4800,  432,  189.00, 384,  4179.00, '[]', '[]');

-- ─── Documentos ──────────────────────────────────────────────
insert into public.documents (company_id, employee_id, name, document_type, file_name, file_size) values
  (v_company_id, v_emp_1, 'Contrato de Trabalho', 'contract',  'contrato_mariana.pdf',  245000),
  (v_company_id, v_emp_1, 'RG',                   'identity',  'rg_mariana.jpg',         88000),
  (v_company_id, v_emp_2, 'Contrato de Trabalho', 'contract',  'contrato_rafael.pdf',   267000),
  (v_company_id, v_emp_2, 'Diploma Universitário','certificate','diploma_rafael.pdf',   512000),
  (v_company_id, v_emp_3, 'Contrato de Trabalho', 'contract',  'contrato_juliana.pdf',  253000);

-- ─── Comunicados ─────────────────────────────────────────────
insert into public.announcements (company_id, title, content, type, target_audience, is_active) values
  (v_company_id,
   'Bem-vindo ao RH Control!',
   'Olá, equipe! A partir de hoje estamos usando o RH Control para gerenciar ponto, férias e documentos. Qualquer dúvida, fale com o RH.',
   'info', 'all', true),
  (v_company_id,
   'Ponto digital obrigatório a partir de segunda-feira',
   'Lembramos que o registro de ponto pelo aplicativo é obrigatório. Baixe o app e configure o acesso com seu RH.',
   'warning', 'all', true),
  (v_company_id,
   'Reunião geral na sexta-feira às 16h',
   'Teremos nossa reunião mensal de equipe na sexta-feira às 16h na sala de reuniões principal. Presença obrigatória.',
   'urgent', 'all', true);

-- ─── Evento no Calendário ────────────────────────────────────
insert into public.calendar_events (company_id, title, date, type, color) values
  (v_company_id, 'Confraternização de Fim de Ano', '2025-12-20', 'event',   '#f59e0b'),
  (v_company_id, 'Reunião de Resultados Q3',        current_date + 7, 'event', '#2563eb'),
  (v_company_id, 'Treinamento NR-17',               current_date + 14,'event', '#8b5cf6');

raise notice '✅ Seed de demonstração criado com sucesso!';
raise notice '   - 4 departamentos';
raise notice '   - 4 cargos';
raise notice '   - 6 colaboradores ativos';
raise notice '   - Registros de ponto, férias, folha, documentos';
raise notice '   - Comunicados e eventos no calendário';

end $$;
