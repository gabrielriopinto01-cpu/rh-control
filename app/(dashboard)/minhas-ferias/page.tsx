'use client'

import { useEffect, useState, useCallback } from 'react'
import { Palmtree, Plus, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'
import { formatDate } from '@/lib/utils'
import type { Vacation, VacationStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<VacationStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending:  { label: 'Aguardando aprovação', icon: <Clock className="h-4 w-4" />,        color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  approved: { label: 'Aprovado',             icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Recusado',             icon: <XCircle className="h-4 w-4" />,      color: 'bg-red-50 text-red-700 border-red-200' },
  taken:    { label: 'Usufruído',            icon: <Palmtree className="h-4 w-4" />,     color: 'bg-gray-50 text-gray-600 border-gray-200' },
}

function calcDays(start: string, end: string) {
  if (!start || !end) return 0
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1)
}

export default function MinhasFeriasPage() {
  const { user }                            = useAuth()
  const { employee, loading: empLoading }   = useMyEmployee()

  const [vacations, setVacations] = useState<Vacation[]>([])
  const [loading,   setLoading]   = useState(true)
  const [dialog,    setDialog]    = useState(false)
  const [form,      setForm]      = useState({ start_date: '', end_date: '', notes: '' })
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !employee) { setLoading(false); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('vacations')
      .select('*')
      .eq('company_id', user.company_id)
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })
    setVacations(data ?? [])
    setLoading(false)
  }, [user, employee])

  useEffect(() => { load() }, [load])

  // Saldo de férias CLT
  const calcBalance = () => {
    if (!employee) return { daysEarned: 0, daysUsed: 0, balance: 0, monthsWorked: 0, nextIn: 0 }
    const hire = new Date(employee.hire_date)
    const now  = new Date()
    const monthsWorked = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth())
    const periodsCompleted = Math.floor(monthsWorked / 12)
    const daysEarned = periodsCompleted * 30
    const daysUsed   = vacations
      .filter(v => v.status === 'approved' || v.status === 'taken')
      .reduce((s, v) => s + (v.days ?? 0), 0)
    const balance  = Math.max(0, daysEarned - daysUsed)
    const nextIn   = 12 - (monthsWorked % 12)
    return { daysEarned, daysUsed, balance, monthsWorked, nextIn }
  }

  const bal = calcBalance()
  const days = calcDays(form.start_date, form.end_date)

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user || !employee) return
    if (!form.start_date || !form.end_date) { toast.error('Preencha as datas'); return }
    if (days > bal.balance) { toast.error(`Saldo insuficiente. Você tem ${bal.balance} dias disponíveis.`); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('vacations').insert({
      company_id:  user.company_id,
      employee_id: employee.id,
      start_date:  form.start_date,
      end_date:    form.end_date,
      days,
      status:      'pending',
      notes:       form.notes || null,
    })
    if (error) { toast.error('Erro ao solicitar férias'); setSaving(false); return }
    toast.success('Férias solicitadas! Aguarde a aprovação do RH.')
    setDialog(false)
    setForm({ start_date: '', end_date: '', notes: '' })
    setSaving(false)
    load()
  }

  if (empLoading) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  if (!employee) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Perfil de funcionário não encontrado</p>
      <p className="text-sm text-gray-400 mt-1">Peça ao RH para vincular seu usuário ao cadastro.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minhas Férias</h1>
          <p className="text-gray-500 mt-1">{employee.full_name}</p>
        </div>
        {bal.balance > 0 && (
          <Button onClick={() => setDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Solicitar férias
          </Button>
        )}
      </div>

      {/* Saldo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Meses trabalhados', value: `${bal.monthsWorked}m`,  color: 'text-gray-700',  bg: 'bg-gray-50' },
          { label: 'Dias adquiridos',   value: `${bal.daysEarned}d`,    color: 'text-blue-700',  bg: 'bg-blue-50' },
          { label: 'Dias usufruídos',   value: `${bal.daysUsed}d`,      color: 'text-orange-600',bg: 'bg-orange-50' },
          { label: 'Saldo disponível',  value: `${bal.balance}d`,       color: bal.balance > 0 ? 'text-green-700' : 'text-red-600', bg: bal.balance > 0 ? 'bg-green-50' : 'bg-red-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {bal.monthsWorked < 12 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-700">
            Você ainda está no período aquisitivo. Férias disponíveis em <strong>{bal.nextIn} meses</strong>.
          </p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="p-8 text-center text-gray-400">Carregando...</div>
      ) : vacations.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Palmtree className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhuma solicitação de férias ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vacations.map(v => {
            const s = STATUS_MAP[v.status]
            return (
              <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Palmtree className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-gray-800">
                      {formatDate(v.start_date)} → {formatDate(v.end_date)}
                    </span>
                    <span className="text-sm text-gray-500">({v.days} dias)</span>
                  </div>
                  {v.notes && <p className="text-sm text-gray-400">{v.notes}</p>}
                  <p className="text-xs text-gray-400">
                    Solicitado em {formatDate(v.created_at.slice(0, 10))}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${s.color} shrink-0`}>
                  {s.icon} {s.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar férias</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRequest} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de início *</Label>
                <Input type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de fim *</Label>
                <Input type="date" value={form.end_date}
                  min={form.start_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>

            {days > 0 && (
              <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${days > bal.balance ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                <Palmtree className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{days} dias</strong> solicitados — saldo disponível: <strong>{bal.balance} dias</strong>
                  {days > bal.balance && <span className="ml-1 font-semibold">⚠️ Saldo insuficiente</span>}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea rows={2} placeholder="Motivo ou observações (opcional)"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <Separator />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || days === 0 || days > bal.balance}>
                {saving && <span className="mr-2 animate-spin">⟳</span>}
                Solicitar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
