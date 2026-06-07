'use client'

import { useEffect, useState, useCallback } from 'react'
import { Palmtree, Clock, CheckCircle2, XCircle, Plus, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import type { Vacation, Employee, VacationStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<VacationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:  { label: 'Pendente',  variant: 'outline' },
  approved: { label: 'Aprovado',  variant: 'default' },
  rejected: { label: 'Recusado', variant: 'destructive' },
  taken:    { label: 'Usufruído',variant: 'secondary' },
}

type FormState = {
  employee_id: string
  start_date: string
  end_date: string
  notes: string
}

function calcDays(start: string, end: string) {
  if (!start || !end) return 0
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, Math.round(diff / 86400000) + 1)
}

export default function VacationsPage() {
  const { user } = useAuth()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<VacationStatus | 'all'>('all')
  const [dialog,    setDialog]    = useState(false)
  const [editingV,  setEditingV]  = useState<Vacation | null>(null)

  const blankForm = (): FormState => ({
    employee_id: '',
    start_date:  '',
    end_date:    '',
    notes:       '',
  })
  const [form, setForm] = useState<FormState>(blankForm)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    // Gestor só vê colaboradores e férias do seu departamento
    let empQ = supabase.from('employees').select('*').eq('company_id', user.company_id)
      .eq('status', 'active').order('full_name')
    if (user.role === 'gestor' && user.department_id) {
      empQ = empQ.eq('department_id', user.department_id)
    }
    const [e, v] = await Promise.all([
      empQ,
      supabase.from('vacations').select('*').eq('company_id', user.company_id)
        .order('created_at', { ascending: false }),
    ])
    const empData = e.data ?? []
    // Filtra férias pelos IDs dos colaboradores do departamento do gestor
    const empIds = empData.map((emp) => emp.id)
    const vacData = (user.role === 'gestor' && user.department_id)
      ? (v.data ?? []).filter((vac) => empIds.includes(vac.employee_id))
      : (v.data ?? [])
    setEmployees(empData)
    setVacations(vacData)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditingV(null); setForm(blankForm()); setDialog(true) }
  const openEdit = (v: Vacation) => {
    setEditingV(v)
    setForm({ employee_id: v.employee_id, start_date: v.start_date, end_date: v.end_date, notes: v.notes ?? '' })
    setDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!form.employee_id || !form.start_date || !form.end_date) {
      toast.error('Preencha todos os campos obrigatórios'); return
    }
    const days = calcDays(form.start_date, form.end_date)
    if (days <= 0) { toast.error('Datas inválidas'); return }
    const supabase = createClient()
    const payload = {
      company_id:  user.company_id,
      employee_id: form.employee_id,
      start_date:  form.start_date,
      end_date:    form.end_date,
      days,
      notes:       form.notes || null,
    }
    if (editingV) {
      const { error } = await supabase.from('vacations').update(payload).eq('id', editingV.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Férias atualizadas!')
    } else {
      const { error } = await supabase.from('vacations').insert({ ...payload, status: 'pending' })
      if (error) { toast.error('Erro ao solicitar'); return }
      toast.success('Solicitação criada!')
    }
    setDialog(false)
    load()
  }

  const changeStatus = async (id: string, status: VacationStatus) => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { error } = await supabase.from('vacations').update({ status, approved_by: user?.id ?? null }).eq('id', id)
    if (error) { toast.error('Erro ao atualizar status'); return }
    toast.success('Status atualizado!')
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta solicitação?')) return
    const supabase = createClient()
    await supabase.from('vacations').delete().eq('id', id)
    toast.success('Solicitação excluída')
    load()
  }

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.full_name ?? '—'
  const filtered = filter === 'all' ? vacations : vacations.filter(v => v.status === filter)

  // Vacation balance: CLT — 30 days earned per completed 12-month acquisition period
  const vacationBalances = employees.map(emp => {
    const hire  = new Date(emp.hire_date)
    const today = new Date()
    const monthsWorked = (today.getFullYear() - hire.getFullYear()) * 12 + (today.getMonth() - hire.getMonth())
    const periodsCompleted = Math.floor(monthsWorked / 12)
    const daysEarned = periodsCompleted * 30

    const daysUsed = vacations
      .filter(v => v.employee_id === emp.id && (v.status === 'approved' || v.status === 'taken'))
      .reduce((sum, v) => sum + (v.days ?? 0), 0)

    const balance = Math.max(0, daysEarned - daysUsed)
    const nextPeriodMonths = monthsWorked % 12

    return { emp, daysEarned, daysUsed, balance, monthsWorked, nextPeriodMonths }
  }).filter(b => b.monthsWorked >= 6) // show only after 6 months of work

  const [showBalance, setShowBalance] = useState(false)

  const stats = {
    pending:  vacations.filter(v => v.status === 'pending').length,
    approved: vacations.filter(v => v.status === 'approved').length,
    taken:    vacations.filter(v => v.status === 'taken').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Férias</h1>
          <p className="text-gray-500 mt-1">Gestão e aprovação de férias</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nova solicitação</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Pendentes', value: stats.pending,  Icon: Clock,        color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Aprovadas', value: stats.approved, Icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Usufruídas',value: stats.taken,    Icon: Palmtree,     color: 'text-blue-600',   bg: 'bg-blue-50' },
        ] as const).map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <Icon className={`h-8 w-8 ${color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-600">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Saldo de férias */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setShowBalance(b => !b)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
        >
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Saldo de férias por colaborador
          </span>
          <span className="text-xs text-gray-400">{showBalance ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        {showBalance && (
          <div className="px-4 pb-4 space-y-2">
            {vacationBalances.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Nenhum colaborador com mais de 6 meses</p>
            ) : vacationBalances.map(({ emp, daysEarned, daysUsed, balance, nextPeriodMonths }) => (
              <div key={emp.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{emp.full_name}</p>
                  <p className="text-xs text-gray-400">
                    {daysEarned} dias acumulados · {daysUsed} usados
                    {nextPeriodMonths > 0 && ` · próximo período em ${12 - nextPeriodMonths} mês(es)`}
                  </p>
                </div>
                <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                  balance === 0 ? 'bg-gray-100 text-gray-500' :
                  balance <= 5  ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                }`}>
                  {balance} dias
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filtro status */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Status:</span>
        <Select defaultValue="all" onValueChange={(v) => setFilter((v ?? 'all') as typeof filter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_MAP).map(([v, { label }]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-gray-400 bg-white rounded-xl border">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
            <Palmtree className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhuma solicitação encontrada</p>
          </div>
        ) : (
          filtered.map(v => {
            const s = STATUS_MAP[v.status]
            return (
              <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Palmtree className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{getEmpName(v.employee_id)}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(v.start_date)} → {formatDate(v.end_date)}
                      <span className="ml-2 font-medium text-gray-700">({v.days} dias)</span>
                    </p>
                    {v.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{v.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={s.variant}>{s.label}</Badge>
                  {v.status === 'pending' && (
                    <>
                      <button
                        onClick={() => changeStatus(v.id, 'approved')}
                        className="p-1.5 rounded-md hover:bg-green-50 text-gray-400 hover:text-green-600"
                        title="Aprovar"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => changeStatus(v.id, 'rejected')}
                        className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500"
                        title="Rejeitar"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openEdit(v)}
                    className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-400"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingV ? 'Editar solicitação' : 'Nova solicitação de férias'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Colaborador *</Label>
              <Select
                defaultValue={form.employee_id || undefined}
                onValueChange={(v) => setForm(f => ({ ...f, employee_id: v ?? '' }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data início *</Label>
                <Input type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data fim *</Label>
                <Input type="date" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            {form.start_date && form.end_date && (
              <p className="text-sm text-blue-600 font-medium">
                Total: {calcDays(form.start_date, form.end_date)} dias
              </p>
            )}
            <Separator />
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea rows={2} placeholder="Opcional..." value={form.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
