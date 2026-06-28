'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, User, Briefcase, MapPin, CreditCard,
  Phone, Mail, Calendar, Hash, Building2, Pencil,
  Loader2, FileText, KeyRound, ShieldCheck, Copy, Check,
  QrCode, Printer, Ban, RotateCcw, ShieldQuestion, Gift, Plus, Trash2,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  const [coworkers,   setCoworkers]   = useState<{ id: string; full_name: string }[]>([])
  const [manager,     setManager]     = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [editOpen,    setEditOpen]    = useState(false)
  const [badgeOpen,   setBadgeOpen]   = useState(false)
  const [badgeCopied, setBadgeCopied] = useState(false)
  const [granting,    setGranting]    = useState(false)
  const [accessInfo,  setAccessInfo]  = useState<{ email: string; tempPassword: string; emailSent: boolean } | null>(null)
  const [copied,      setCopied]      = useState(false)
  const [empBenefits, setEmpBenefits] = useState<any[]>([])
  const [allBenefits, setAllBenefits] = useState<any[]>([])
  const [addingBenefit, setAddingBenefit] = useState(false)
  const [selBenefit,  setSelBenefit]  = useState('')
  const [salaryHistory, setSalaryHistory] = useState<any[]>([])
  const [showSalaryForm, setShowSalaryForm] = useState(false)
  const [newSalary,    setNewSalary]    = useState('')
  const [salaryReason, setSalaryReason] = useState('')
  const [salaryDate,   setSalaryDate]   = useState(new Date().toISOString().slice(0, 10))

  const isReadOnly = user?.role === 'gestor' || user?.role === 'colaborador'

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !id) { setLoading(false); return }
    const supabase = createClient()

    const [empRes, deptRes, posRes, coRes] = await Promise.allSettled([
      supabase.from('employees').select('*').eq('id', id).eq('company_id', user.company_id).single(),
      supabase.from('departments').select('*').eq('company_id', user.company_id).order('name'),
      supabase.from('positions').select('*').eq('company_id', user.company_id).order('title'),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).order('full_name'),
    ])

    if (empRes.status === 'fulfilled' && empRes.value.data) {
      const emp   = empRes.value.data as Employee
      const depts = deptRes.status === 'fulfilled' ? (deptRes.value.data ?? []) : []
      const poses = posRes.status  === 'fulfilled' ? (posRes.value.data  ?? []) : []
      const cos   = coRes.status   === 'fulfilled' ? (coRes.value.data   ?? []) : []
      setEmployee(emp)
      setDepartments(depts)
      setPositions(poses)
      setCoworkers(cos.filter((c: { id: string }) => c.id !== emp.id))
      setManager(cos.find((c: { id: string }) => c.id === emp.manager_id)?.full_name ?? null)
      setDepartment(depts.find(d => d.id === emp.department_id) ?? null)
      setPosition(poses.find(p => p.id === emp.position_id) ?? null)
    } else {
      toast.error('Colaborador não encontrado')
      router.push('/employees')
    }
    setLoading(false)
  }, [id, user, router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!id || !canGrant) return
    fetch(`/api/benefits/employee/${id}`).then(r => r.json()).then(setEmpBenefits)
    fetch('/api/benefits').then(r => r.json()).then(setAllBenefits)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadSalaryHistory = useCallback(async () => {
    if (!isSupabaseConfigured() || !id) return
    const supabase = createClient()
    const { data } = await supabase
      .from('salary_history')
      .select('*')
      .eq('employee_id', id)
      .order('effective_date', { ascending: false })
    setSalaryHistory(data ?? [])
  }, [id])

  useEffect(() => { if (id && !isReadOnly) loadSalaryHistory() }, [id, isReadOnly, loadSalaryHistory])

  const saveSalaryAdjustment = async () => {
    const value = Number(newSalary.replace(/[^0-9.]/g, ''))
    if (!value || !salaryDate) { toast.error('Preencha o novo salário e a data'); return }
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { error } = await supabase.from('salary_history').insert({
      employee_id:   id,
      salary:        value,
      effective_date: salaryDate,
      reason:        salaryReason.trim() || null,
      recorded_by:   user?.id,
    })
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        toast.error('Tabela salary_history não existe. Execute o SQL de migração.')
      } else { toast.error('Erro ao salvar reajuste') }
      return
    }
    await supabase.from('employees').update({ salary: value }).eq('id', id!)
    toast.success('Reajuste registrado!')
    setShowSalaryForm(false); setNewSalary(''); setSalaryReason('')
    load(); loadSalaryHistory()
  }

  async function addBenefit() {
    if (!selBenefit) return
    await fetch(`/api/benefits/employee/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ benefit_id: selBenefit }) })
    const res = await fetch(`/api/benefits/employee/${id}`)
    setEmpBenefits(await res.json())
    setAddingBenefit(false); setSelBenefit('')
  }

  async function removeBenefit(ebId: string) {
    await fetch(`/api/benefits/employee/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ebId }) })
    setEmpBenefits(prev => prev.filter((b: any) => b.id !== ebId))
  }

  const canGrant = user?.role === 'adm_total' || user?.role === 'rh'

  const handleEdit = async (data: EmployeeFormData, avatarUrl?: string | null) => {
    if (!isSupabaseConfigured() || !user || !employee) return
    const supabase = createClient()
    const { error } = await supabase.from('employees').update({
      avatar_url:    avatarUrl ?? employee.avatar_url,
      full_name:     data.full_name,
      cpf:           data.cpf,
      rg:            data.rg ?? null,
      cnh:           data.cnh ?? null,
      birth_date:    data.birth_date || null,
      hire_date:     data.hire_date,
      contract_type: data.contract_type,
      salary:        data.salary,
      department_id: data.department_id || null,
      position_id:   data.position_id || null,
      manager_id:    data.manager_id || null,
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

  const handleGrantAccess = async () => {
    if (!employee) return
    if (!employee.email) {
      toast.error('Cadastre um e-mail para o colaborador antes de conceder acesso.')
      return
    }
    setGranting(true)
    try {
      const res = await fetch('/api/employees/grant-access', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employeeId: employee.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Erro ao conceder acesso')
        return
      }
      setAccessInfo({ email: json.email, tempPassword: json.tempPassword, emailSent: json.emailSent })
      toast.success('Acesso concedido!')
      load()
    } catch {
      toast.error('Erro ao conceder acesso')
    } finally {
      setGranting(false)
    }
  }

  const toggleBadge = async () => {
    if (!employee || !isSupabaseConfigured()) return
    const supabase = createClient()
    const next = !(employee.badge_active ?? true)
    const { error } = await supabase.from('employees').update({ badge_active: next }).eq('id', employee.id)
    if (error) { toast.error('Erro ao atualizar crachá'); return }
    toast.success(next ? 'Crachá reativado!' : 'Crachá revogado!')
    setEmployee({ ...employee, badge_active: next })
  }

  if (!employee) return null

  const status = STATUS_MAP[employee.status] ?? { label: employee.status, color: 'bg-gray-100 text-gray-600' }
  const badgeUrl = typeof window !== 'undefined' && employee.badge_token
    ? `${window.location.origin}/cracha/${employee.badge_token}` : ''
  const qrSrc = badgeUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(badgeUrl)}` : ''

  const defaultValues = {
    full_name:     employee.full_name,
    cpf:           employee.cpf,
    rg:            employee.rg ?? '',
    cnh:           employee.cnh ?? '',
    birth_date:    employee.birth_date ?? '',
    hire_date:     employee.hire_date,
    contract_type: employee.contract_type,
    salary:        employee.salary,
    department_id: employee.department_id ?? '',
    position_id:   employee.position_id ?? '',
    manager_id:    employee.manager_id ?? '',
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
            <Button onClick={() => setBadgeOpen(true)} variant="outline" size="sm">
              <QrCode className="h-4 w-4 mr-2" /> Crachá
            </Button>
            {canGrant && (
              <Button variant="outline" size="sm" onClick={() => {
                window.open(`/api/employees/${employee.id}/lgpd-export`, '_blank')
              }}>
                <ShieldQuestion className="h-4 w-4 mr-2" /> LGPD
              </Button>
            )}
            {!isReadOnly && (
              <Button onClick={() => setEditOpen(true)} variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal do crachá */}
      <Dialog open={badgeOpen} onOpenChange={setBadgeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="h-4 w-4" /> Crachá inteligente</DialogTitle>
          </DialogHeader>
          <div id="badge-print" className="space-y-4">
            {/* Frente do crachá */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-5 py-3">
                <p className="text-white font-semibold text-sm">{department?.name ? `${department.name}` : 'Colaborador'}</p>
              </div>
              <div className="flex items-center gap-4 px-5 py-4">
                <Avatar className="h-16 w-16">
                  {employee.avatar_url && <AvatarImage src={employee.avatar_url} alt={employee.full_name} />}
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">
                    {getInitials(employee.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{employee.full_name}</p>
                  {position && <p className="text-sm text-gray-500 truncate">{position.title}</p>}
                  {employee.employee_code && <p className="text-xs text-gray-400">Matrícula: {employee.employee_code}</p>}
                </div>
              </div>
            </div>

            {/* QR (verso) */}
            <div className="flex flex-col items-center gap-2">
              {qrSrc
                ? <img src={qrSrc} alt="QR Code" className="h-44 w-44" />
                : <p className="text-sm text-gray-400 py-8">Salve o crachá (rode a migração) para gerar o QR.</p>}
              {(employee.badge_active === false) && (
                <span className="text-xs text-red-600 font-medium">⚠ Crachá revogado — QR inativo</span>
              )}
            </div>
          </div>

          {/* Ações */}
          {badgeUrl && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(badgeUrl); setBadgeCopied(true); setTimeout(() => setBadgeCopied(false), 2000)
              }}>
                {badgeCopied ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                Copiar link
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir
              </Button>
              {canGrant && (
                employee.badge_active === false ? (
                  <Button variant="outline" size="sm" className="col-span-2 text-green-700" onClick={toggleBadge}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reativar crachá
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="col-span-2 text-red-600" onClick={toggleBadge}>
                    <Ban className="h-3.5 w-3.5 mr-1.5" /> Revogar crachá
                  </Button>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Acesso do colaborador */}
      {canGrant && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${employee.profile_id ? 'bg-green-100' : 'bg-blue-100'}`}>
                {employee.profile_id
                  ? <ShieldCheck className="h-5 w-5 text-green-600" />
                  : <KeyRound className="h-5 w-5 text-blue-600" />}
              </div>
              <div>
                <p className="font-semibold text-gray-900">Acesso ao sistema</p>
                <p className="text-sm text-gray-500">
                  {employee.profile_id
                    ? 'Este colaborador já tem login na área dele.'
                    : 'Crie um login para o colaborador acessar a área dele.'}
                </p>
              </div>
            </div>
            {!employee.profile_id && (
              <Button onClick={handleGrantAccess} disabled={granting}>
                {granting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Concedendo...</>
                  : <><KeyRound className="h-4 w-4 mr-2" /> Conceder acesso</>}
              </Button>
            )}
          </div>

          {/* Senha temporária gerada */}
          {accessInfo && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-900 mb-2">
                ✅ Acesso criado! Repasse estes dados ao colaborador:
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-amber-700 w-16">E-mail:</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-amber-200">{accessInfo.email}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-700 w-16">Senha:</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-amber-200 font-bold">{accessInfo.tempPassword}</code>
                  <Button
                    variant="ghost" size="sm" className="h-7 px-2"
                    onClick={() => {
                      navigator.clipboard.writeText(`E-mail: ${accessInfo.email}\nSenha: ${accessInfo.tempPassword}`)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-amber-700 mt-3">
                {accessInfo.emailSent
                  ? '📧 Um e-mail com estas instruções também foi enviado ao colaborador.'
                  : '⚠️ O e-mail não pôde ser enviado automaticamente — repasse a senha manualmente.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Grid de detalhes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Dados Pessoais">
          <InfoRow icon={Hash}      label="CPF"               value={formatCPF(employee.cpf)} />
          <InfoRow icon={FileText}  label="RG"                value={employee.rg} />
          <InfoRow icon={CreditCard} label="CNH"              value={employee.cnh} />
          <InfoRow icon={Calendar}  label="Data de nascimento" value={employee.birth_date ? formatDate(employee.birth_date) : null} />
          <InfoRow icon={Mail}      label="E-mail"            value={employee.email} />
          <InfoRow icon={Phone}     label="Telefone"          value={employee.phone} />
        </Section>

        <Section title="Dados Profissionais">
          <InfoRow icon={Building2} label="Departamento"      value={department?.name} />
          <InfoRow icon={Briefcase} label="Cargo"             value={position?.title} />
          <InfoRow icon={User}      label="Gestor responsável" value={manager} />
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

      {/* Benefícios */}
      {canGrant && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Gift className="h-4 w-4" /> Benefícios</h3>
            <Button size="sm" variant="outline" onClick={() => setAddingBenefit(a => !a)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Vincular
            </Button>
          </div>
          {addingBenefit && (
            <div className="flex gap-2 mb-3">
              <select value={selBenefit} onChange={e => setSelBenefit(e.target.value)}
                className="flex-1 border rounded-md px-3 py-1.5 text-sm bg-white">
                <option value="">Selecione um benefício...</option>
                {allBenefits.filter((b: any) => b.active && !empBenefits.find((eb: any) => eb.benefit_id === b.id)).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <Button size="sm" onClick={addBenefit} disabled={!selBenefit}>Adicionar</Button>
            </div>
          )}
          {empBenefits.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Nenhum benefício vinculado</p>
          ) : (
            <div className="space-y-2">
              {empBenefits.map((eb: any) => (
                <div key={eb.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <div>
                    <span className="font-medium">{eb.benefit?.name}</span>
                    {eb.benefit?.employee_discount != null && (
                      <span className="text-gray-400 ml-2 text-xs">− R$ {Number(eb.benefit.employee_discount).toFixed(2)}/mês</span>
                    )}
                  </div>
                  <button onClick={() => removeBenefit(eb.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico de Salário */}
      {!isReadOnly && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-base">💰</span> Histórico de Salário
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowSalaryForm(v => !v)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Registrar reajuste
            </Button>
          </div>
          {showSalaryForm && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Novo salário (R$) *</label>
                  <input type="number" step="0.01" placeholder="Ex: 5000.00" value={newSalary}
                    onChange={e => setNewSalary(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Data de vigência *</label>
                  <input type="date" value={salaryDate} onChange={e => setSalaryDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Motivo (opcional)</label>
                <input type="text" placeholder="Ex: Promoção, Dissídio 2025..." value={salaryReason}
                  onChange={e => setSalaryReason(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveSalaryAdjustment}>Salvar reajuste</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSalaryForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}
          {salaryHistory.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum reajuste registrado ainda.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {salaryHistory.map((h, i) => {
                const prev = salaryHistory[i + 1]
                const diff = prev ? ((h.salary - prev.salary) / prev.salary * 100) : null
                return (
                  <div key={h.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{formatCurrency(h.salary)}</p>
                      <p className="text-xs text-gray-400">{formatDate(h.effective_date)}{h.reason ? ` · ${h.reason}` : ''}</p>
                    </div>
                    {diff !== null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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
            managers={coworkers}
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
