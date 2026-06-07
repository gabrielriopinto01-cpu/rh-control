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
  | 'cpf' | 'rg' | 'ctps' | 'pis' | 'contrato' | 'admissao'
  | 'demissao' | 'ferias' | 'atestado' | 'outro'

// ─── Companies ───────────────────────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  slug: string
  cnpj: string | null
  logo_url: string | null
  plan: CompanyPlan
  status: CompanyStatus
  created_at: string
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
  created_at: string
}
