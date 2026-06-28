export type UserRole = 'adm_total' | 'rh' | 'gestor' | 'colaborador'

export type CompanyPlan = 'free' | 'starter' | 'pro' | 'enterprise'

export type CompanyStatus = 'active' | 'inactive' | 'suspended'

export type EmployeeStatus = 'active' | 'inactive' | 'on_leave' | 'terminated'

export type ContractType = 'clt' | 'pj' | 'estagio' | 'temporario'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'holiday' | 'vacation'

export type VacationStatus = 'pending' | 'approved' | 'rejected' | 'taken'

export type PayrollStatus = 'open' | 'processing' | 'closed'

export type CandidateStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'

export type JobStatus = 'open' | 'paused' | 'closed'

export type DocumentType =
  | 'cpf' | 'rg' | 'cnh' | 'ctps' | 'pis' | 'comprovante_residencia'
  | 'contrato' | 'ficha_registro' | 'admissao' | 'demissao'
  | 'exame_admissional' | 'exame_periodico' | 'exame_demissional' | 'aso'
  | 'certificado' | 'treinamento' | 'advertencia' | 'epi'
  | 'holerite' | 'ferias' | 'atestado' | 'outro'

// ─── Companies ───────────────────────────────────────────────────────────────

export interface Branding {
  primary?: string
  secondary?: string
  button?: string
  system_name?: string
  tagline?: string
  footer?: string
}

export interface Company {
  id: string
  name: string
  slug: string
  cnpj: string | null
  logo_url: string | null
  branding: Branding | null
  plan: CompanyPlan
  status: CompanyStatus
  attendance_config?: AttendanceConfig | null
  whatsapp_instance?: string | null
  created_at: string
}

export interface AttendanceConfig {
  geofence_enabled?: boolean
  lat?: number
  lng?: number
  radius_m?: number
  require_selfie?: boolean
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  company_id: string
  employee_id: string | null
  full_name: string
  email: string
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

// ─── Departments ─────────────────────────────────────────────────────────────

export interface Department {
  id: string
  company_id: string
  name: string
  manager_id: string | null
  parent_id: string | null
  created_at: string
}

// ─── Positions ───────────────────────────────────────────────────────────────

export interface Position {
  id: string
  company_id: string
  department_id: string | null
  title: string
  salary_min: number | null
  salary_max: number | null
  cbo_code: string | null
  created_at: string
}

// ─── Employees ───────────────────────────────────────────────────────────────

export interface BankDetails {
  bank: string
  agency: string
  account: string
  account_type: 'corrente' | 'poupanca'
  pix_key: string | null
}

export interface Address {
  cep: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
}

export interface Employee {
  id: string
  company_id: string
  profile_id: string | null
  department_id: string | null
  position_id: string | null
  employee_code: string
  full_name: string
  cpf: string
  rg: string | null
  cnh: string | null
  manager_id: string | null
  birth_date: string | null
  hire_date: string
  termination_date: string | null
  contract_type: ContractType
  salary: number
  email: string | null
  phone: string | null
  avatar_url: string | null
  bank_details: BankDetails | null
  address: Address | null
  status: EmployeeStatus
  badge_token?: string | null
  badge_active?: boolean | null
  created_at: string
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string
  company_id: string
  employee_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  lunch_start: string | null
  lunch_end: string | null
  total_hours: number | null
  overtime: number | null
  status: AttendanceStatus
  notes: string | null
}

export type PunchKind = 'in' | 'lunch_start' | 'lunch_end' | 'out'

export interface AttendancePunch {
  id: string
  company_id: string
  employee_id: string
  record_id: string | null
  kind: PunchKind
  punched_at: string
  latitude: number | null
  longitude: number | null
  address: string | null
  selfie_url: string | null
  ip: string | null
  device: string | null
  within_fence: boolean | null
  created_at: string
}

// ─── Atestados ───────────────────────────────────────────────────────────────

export interface MedicalCertificate {
  id: string
  company_id: string
  employee_id: string
  doctor_name: string | null
  crm: string | null
  cid: string | null
  start_date: string
  days: number
  file_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

// ─── Afastamentos / Ocorrências ────────────────────────────────────────────────

export type LeaveType =
  | 'inss' | 'maternidade' | 'paternidade' | 'obito' | 'casamento'
  | 'acidente' | 'suspensao' | 'falta_abonada' | 'falta' | 'advertencia' | 'outro'

export interface Leave {
  id: string
  company_id: string
  employee_id: string
  type: LeaveType
  start_date: string
  end_date: string | null
  reason: string | null
  file_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

// ─── Fechamento de Banco de Horas ───────────────────────────────────────────

export interface TimeBankClosure {
  id: string
  company_id: string
  employee_id: string
  reference_month: string
  worked_hours: number
  overtime_hours: number
  balance_hours: number
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  approved_by: string | null
  approved_at: string | null
  created_by: string | null
  created_at: string
}

// ─── Checklists (admissão / desligamento) ──────────────────────────────────────

export interface ChecklistItem {
  label: string
  done: boolean
}

export interface EmployeeChecklist {
  id: string
  company_id: string
  employee_id: string
  type: 'onboarding' | 'offboarding'
  items: ChecklistItem[]
  created_by: string | null
  created_at: string
}

// ─── Pesquisa de Clima ───────────────────────────────────────────────────────

export interface ClimateQuestion {
  id: string
  text: string
}

export interface ClimateSurvey {
  id: string
  company_id: string
  title: string
  description: string | null
  questions: ClimateQuestion[]
  is_active: boolean
  anonymous: boolean
  created_by: string | null
  created_at: string
}

export interface ClimateResponse {
  id: string
  survey_id: string
  company_id: string
  employee_id: string | null
  answers: Record<string, number>
  comment: string | null
  created_at: string
}

// ─── Treinamentos (LMS) ──────────────────────────────────────────────────────

export type TrainingContentType = 'video' | 'pdf' | 'link'

export interface Training {
  id: string
  company_id: string
  title: string
  description: string | null
  content_type: TrainingContentType
  content_url: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface TrainingCompletion {
  id: string
  training_id: string
  employee_id: string
  company_id: string
  score: number | null
  completed_at: string
}

// ─── Equipamentos / Ativos ──────────────────────────────────────────────────

export type EquipmentCategory =
  | 'notebook' | 'celular' | 'tablet' | 'ferramenta' | 'uniforme'
  | 'veiculo' | 'chave' | 'cartao' | 'cracha' | 'outro'

export type EquipmentStatus = 'disponivel' | 'entregue' | 'devolvido' | 'manutencao' | 'baixado'

export interface Equipment {
  id: string
  company_id: string
  employee_id: string | null
  name: string
  category: EquipmentCategory
  identifier: string | null
  status: EquipmentStatus
  delivered_at: string | null
  returned_at: string | null
  photo_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

// ─── Vacations ────────────────────────────────────────────────────────────────

export interface Vacation {
  id: string
  company_id: string
  employee_id: string
  start_date: string
  end_date: string
  days: number
  status: VacationStatus
  approved_by: string | null
  notes: string | null
  created_at: string
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

export interface Payroll {
  id: string
  company_id: string
  reference_month: string
  status: PayrollStatus
  total_gross: number
  total_deductions: number
  total_net: number
  closed_at: string | null
  created_at: string
}

export interface PayrollItem {
  id: string
  payroll_id: string
  employee_id: string
  gross_salary: number
  inss: number
  irrf: number
  fgts: number
  other_discounts: Record<string, number> | null
  other_additions: Record<string, number> | null
  net_salary: number
}

// ─── Documents ───────────────────────────────────────────────────────────────

export interface Document {
  id: string
  company_id: string
  employee_id: string
  type: DocumentType
  name: string
  file_url: string
  expires_at: string | null
  notes: string | null
  created_at: string
}

// ─── Recruitment ─────────────────────────────────────────────────────────────

export interface JobOpening {
  id: string
  company_id: string
  position_id: string | null
  title: string
  description: string | null
  requirements: string | null
  status: JobStatus
  open_date: string
  close_date: string | null
  created_at: string
}

export interface Candidate {
  id: string
  job_opening_id: string
  name: string
  email: string
  phone: string | null
  resume_url: string | null
  stage: CandidateStage
  notes: string | null
  created_at: string
}

// ─── Performance ─────────────────────────────────────────────────────────────

export interface PerformanceReview {
  id: string
  company_id: string
  employee_id: string
  reviewer_id: string
  period: string
  score: number | null
  feedback: string | null
  goals: Array<{ title: string; achieved: boolean }> | null
  status: 'draft' | 'submitted' | 'acknowledged'
  review_type?: 'manager' | 'self' | 'peer'
  created_at: string
}
