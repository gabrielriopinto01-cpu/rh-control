'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, User, Briefcase, MapPin, CreditCard,
  Phone, Mail, Calendar, Hash, Building2, Pencil,
  Loader2, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { EmployeeForm } from '@/components/modules/employees/employee-form'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate, formatCPF, getInitials } from '@/lib/utils'
import type { Employee, Department, Position } from '@/types/database'
import type { EmployeeFormData } from '@/lib/validations/employee'

export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:     { label: 'Ativo',     color: 'bg-green-100 text-green-700' },
  inactive:   { label: 'Inativo',   color: 'bg-gray-100 text-gray-600' },
  on_leave:   { label: 'Afastado',  color: 'bg-yellow-100 text-yellow-700' },
  terminated: { label: 'Desligado', color: 'bg-red-100 text-red-700' },
}

const CONTRACT_MAP: Record<string, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estágio', temporario: 'Temporário',
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      <Separator className="mb-2" />
      {children}
    </div>
  )
}

export default function EmployeeDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuth()

  const [employee,    setEmployee]    = useState<Employee | null>(null)
  const [department,  setDepartment]  = useState<Department | null>(null)
  const [position,    setPosition]    = useState<Position | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions,   setPositions]   = useState<Position[]>([])
  const [loading,     setLoading]     = useState(true)
  const [editOpen,    setEditOpen]    = useState(false)

  const isReadOnly = user?.role === 'gestor' || user?.role === 'colaborador'

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !id) { setLoading(false); return }
    const supabase = createClient()

    const [empRes, deptRes, posRes] = await Promise.allSettled([
      supabase.from('employees').select('*').eq('id', id).eq('company_id', user.company_id).single(),
      supabase.from('departments').select('*').eq('company_id', user.company_id).order('name'),
      supabase.from('positions').select('*').eq('company_id', user.company_id).order('title'),
    ])

    if (empRes.status === 'fulfilled' && empRes.value.data) {
      const emp   = empRes.value.data as Employee
      const depts = deptRes.status === 'fulfilled' ? (deptRes.value.data ?? []) : []
      const poses = posRes.status  === 'fulfilled' ? (posRes.value.data  ?? []) : []
      setEmployee(emp)
      setDepartments(depts)
      setPositions(poses)
      setDepartment(depts.find(d => d.id === emp.department_id) ?? null)
      setPosition(poses.find(p => p.id === emp.position_id) ?? null)
    } else {
      toast.error('Colaborador não encontrado')
      router.push('/employees')
    }
    setLoading(false)
  }, [id, user, router])

  useEffect(() => { load() }, [load])

  const handleEdit = async (data: EmployeeFormData, avatarUrl?: string | null) => {
    if (!isSupabaseConfigured() || !user || !employee) return
    const supabase = createClient()
    const { error } = await supabase.from('employees').update({
      avatar_url:    avatarUrl ?? employee.avatar_url,
      full_name:     data.full_name,
      cpf:           data.cpf,
      rg:            data.rg ?? null,
      birth_date:    data.birth_date || null,
      hire_date:     data.hire_date,
      contract_type: data.contract_type,
      salary:        data.salary,
      department_id: data.department_id || null,
      position_id:   data.position_id || null,
      status:        data.status,
      email:         data.email || null,
      phone:         data.phone || null,
      bank_details: data.bank ? {
        bank: data.bank, agency: data.agency ?? '', account: data.account ?? '',
        account_type: data.account_type ?? 'corrente', pix_key: data.pix_key ?? null,
      } : null,
      address: data.cep ? {
        cep: data.cep, street: data.street ?? '', number: data.number ?? '',
        complement: data.complement ?? null, neighborhood: data.neighborhood ?? '',
        city: data.city ?? '', state: data.state ?? '',
      } : null,
    }).eq('id', employee.id)

    if (error) { toast.error('Erro ao salvar'); return }
    toast.success('Colaborador atualizado!')
    setEditOpen(false)
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!employee) return null

  const status = STATUS_MAP[employee.status] ?? { label: employee.status, color: 'bg-gray-100 text-gray-600' }

  const defaultValues = {
    full_name:     employee.full_name,
    cpf:           employee.cpf,
    rg:            employee.rg ?? '',
    birth_date:    employee.birth_date ?? '',
    hire_date:     employee.hire_date,
    contract_type: employee.contract_type,
    salary:        employee.salary,
    department_id: employee.department_id ?? '',
    position_id:   employee.position_id ?? '',
    status:        employee.status,
    email:         employee.email ?? '',
    phone:         employee.phone ?? '',
    bank:          employee.bank_details?.bank ?? '',
    agency:        employee.bank_details?.agency ?? '',
    account:       employee.bank_details?.account ?? '',
    account_type:  employee.bank_details?.account_type ?? 'corrente',
    pix_key:       employee.bank_details?.pix_key ?? '',
    cep:           employee.address?.cep ?? '',
    street:        employee.address?.street ?? '',
    number:        employee.address?.number ?? '',
    complement:    employee.address?.complement ?? '',
    neighborhood:  employee.address?.neighborhood ?? '',
    city:          employee.address?.city ?? '',
    state:         employee.address?.state ?? '',
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-gray-500">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
        </Button>
      </div>

      {/* Card principal */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20">
              {employee.avatar_url && (
                <AvatarImage src={employee.avatar_url} alt={employee.full_name} />
              )}
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl font-bold">
                {getInitials(employee.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{employee.full_name}</h1>
              {position && <p className="text-gray-500 mt-0.5">{position.title}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
                <Badge variant="outline">{CONTRACT_MAP[employee.contract_type] ?? employee.contract_type}</Badge>
                {department && <Badge variant="secondary">{department.name}</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
              <p className="text-xs text-green-700 uppercase tracking-wide font-medium">Salário</p>
              <p className="text-xl font-bold text-green-800 mt-0.5">{formatCurrency(employee.salary)}</p>
            </div>
            {!isReadOnly && (
              <Button onClick={() => setEditOpen(true)} variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Grid de detalhes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Dados Pessoais">
          <InfoRow icon={Hash}      label="CPF"               value={formatCPF(employee.cpf)} />
          <InfoRow icon={FileText}  label="RG"                value={employee.rg} />
          <InfoRow icon={Calendar}  label="Data de nascimento" value={employee.birth_date ? formatDate(employee.birth_date) : null} />
          <InfoRow icon={Mail}      label="E-mail"            value={employee.email} />
          <InfoRow icon={Phone}     label="Telefone"          value={employee.phone} />
        </Section>

        <Section title="Dados Profissionais">
          <InfoRow icon={Building2} label="Departamento"      value={department?.name} />
          <InfoRow icon={Briefcase} label="Cargo"             value={position?.title} />
          <InfoRow icon={Calendar}  label="Data de admissão"  value={formatDate(employee.hire_date)} />
          {employee.termination_date && (
            <InfoRow icon={Calendar} label="Desligamento"     value={formatDate(employee.termination_date)} />
          )}
          {employee.employee_code && (
            <InfoRow icon={Hash}    label="Código"            value={employee.employee_code} />
          )}
        </Section>

        {employee.bank_details && (
          <Section title="Dados Bancários">
            <InfoRow icon={CreditCard} label="Banco"   value={employee.bank_details.bank} />
            <InfoRow icon={Hash}       label="Agência" value={employee.bank_details.agency} />
            <InfoRow icon={Hash}       label="Conta"   value={employee.bank_details.account} />
            <InfoRow icon={CreditCard} label="Tipo"    value={employee.bank_details.account_type === 'corrente' ? 'Conta Corrente' : 'Poupança'} />
            {employee.bank_details.pix_key && (
              <InfoRow icon={Hash}     label="Chave PIX" value={employee.bank_details.pix_key} />
            )}
          </Section>
        )}

        {employee.address && (
          <Section title="Endereço">
            <InfoRow
              icon={MapPin} label="Endereço"
              value={`${employee.address.street}, ${employee.address.number}${employee.address.complement ? ` — ${employee.address.complement}` : ''}`}
            />
            <InfoRow icon={MapPin} label="Bairro"    value={employee.address.neighborhood} />
            <InfoRow icon={MapPin} label="Cidade/UF" value={`${employee.address.city} — ${employee.address.state}`} />
            <InfoRow icon={MapPin} label="CEP"       value={employee.address.cep} />
          </Section>
        )}
      </div>

      {/* Sheet de edição */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Editar colaborador</SheetTitle>
          </SheetHeader>
          <EmployeeForm
            defaultValues={defaultValues}
            departments={departments}
            positions={positions}
            companyId={user?.company_id}
            initialAvatarUrl={employee.avatar_url}
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
