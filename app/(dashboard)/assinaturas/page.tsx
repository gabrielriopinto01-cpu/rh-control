'use client'

import { useEffect, useState, useCallback } from 'react'
import { PenLine, Plus, Clock, CheckCircle2, XCircle, Eye, Send, X, FileText, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type Signature = {
  id: string; document_name: string; document_type: string; status: string
  sent_at: string; signed_at: string | null; expires_at: string
  employee: { full_name: string; email: string } | null
  token: string
  signed_ip?: string | null
}

type Employee = { id: string; full_name: string; email: string | null }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  pending:  { label: 'Aguardando', color: 'bg-amber-100 text-amber-700',  icon: Clock },
  viewed:   { label: 'Visualizado', color: 'bg-blue-100 text-blue-700',   icon: Eye },
  signed:   { label: 'Assinado',   color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  rejected: { label: 'Rejeitado',  color: 'bg-red-100 text-red-700',      icon: XCircle },
  expired:  { label: 'Expirado',   color: 'bg-gray-100 text-gray-500',    icon: AlertTriangle },
}

const DOC_TYPES = [
  { value: 'contract', label: 'Contrato de Trabalho' },
  { value: 'warning',  label: 'Advertência' },
  { value: 'holerite', label: 'Holerite' },
  { value: 'lgpd',     label: 'Termo LGPD' },
  { value: 'policy',   label: 'Regulamento Interno' },
]

export default function AssinaturasPage() {
  const { user }     = useAuth()
  const [sigs,       setSigs]       = useState<Signature[]>([])
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [trail,      setTrail]      = useState<{ sig: Signature; events: any[] } | null>(null)
  const [filter,     setFilter]     = useState('all')
  const [form, setForm] = useState({
    employee_id: '', document_name: '', document_type: 'contract',
    document_html: '', expires_days: '7',
  })

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return
    setLoading(true)
    const supabase = createClient()
    const [sRes, eRes] = await Promise.all([
      supabase.from('digital_signatures')
        .select('*, employee:employees(full_name, email)')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false }),
      supabase.from('employees')
        .select('id, full_name, email')
        .eq('company_id', user.company_id)
        .eq('status', 'active')
        .order('full_name'),
    ])
    setSigs((sRes.data as Signature[]) ?? [])
    setEmployees((eRes.data as Employee[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.employee_id || !form.document_name) {
      toast.error('Selecione o colaborador e informe o nome do documento')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + parseInt(form.expires_days))

    const { data, error } = await supabase.from('digital_signatures').insert({
      company_id:    user!.company_id,
      employee_id:   form.employee_id,
      document_name: form.document_name,
      document_type: form.document_type,
      document_html: form.document_html || null,
      expires_at:    expiresAt.toISOString(),
      created_by:    user!.id,
      status:        'pending',
    }).select().single()

    if (error) { toast.error('Erro ao criar solicitação'); setSaving(false); return }

    // Registra trilha
    await supabase.from('signature_audit_trail').insert({
      signature_id: data.id, event: 'sent',
      description: `Documento enviado para assinatura por ${user!.email}`,
    })

    // TODO: enviar e-mail ao colaborador com link /sign/[token]
    const signUrl = `${window.location.origin}/sign/${data.token}`
    toast.success(
      <div>
        <p className="font-semibold">Solicitação criada!</p>
        <p className="text-xs mt-1 text-gray-600">Link: <span className="font-mono">{signUrl}</span></p>
      </div>
    )

    setSaving(false)
    setShowForm(false)
    setForm({ employee_id: '', document_name: '', document_type: 'contract', document_html: '', expires_days: '7' })
    load()
  }

  const loadTrail = async (sig: Signature) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('signature_audit_trail')
      .select('*')
      .eq('signature_id', sig.id)
      .order('created_at')
    setTrail({ sig, events: data ?? [] })
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/sign/${token}`
    navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  const filtered = filter === 'all' ? sigs : sigs.filter(s => s.status === filter)

  const counts = {
    all:      sigs.length,
    pending:  sigs.filter(s => s.status === 'pending').length,
    signed:   sigs.filter(s => s.status === 'signed').length,
    rejected: sigs.filter(s => s.status === 'rejected').length,
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <PenLine className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assinatura Digital</h1>
            <p className="text-gray-500 text-sm">Contratos, advertências, holerites e termos</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Solicitar assinatura
        </Button>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all',      label: 'Total',         color: 'text-gray-700' },
          { key: 'pending',  label: 'Aguardando',    color: 'text-amber-600' },
          { key: 'signed',   label: 'Assinados',     color: 'text-green-600' },
          { key: 'rejected', label: 'Rejeitados',    color: 'text-red-500' },
        ].map(c => (
          <button key={c.key} onClick={() => setFilter(c.key)}
            className={`bg-white rounded-xl border p-4 text-left transition-all hover:border-blue-300 ${filter === c.key ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-400 font-medium">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{counts[c.key as keyof typeof counts]}</p>
          </button>
        ))}
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Nova solicitação de assinatura</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Colaborador *</Label>
                <select value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}{e.email ? ` — ${e.email}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de documento *</Label>
                <select value={form.document_type}
                  onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Nome do documento *</Label>
                <Input placeholder="Ex: Contrato de Trabalho — João Silva" value={form.document_name}
                  onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Validade (dias)</Label>
                <Input type="number" min={1} max={30} value={form.expires_days}
                  onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))} className="w-32" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Conteúdo do documento <span className="text-gray-400">(opcional — aparece na tela de assinatura)</span></Label>
                <textarea rows={5} placeholder="Cole aqui o texto do documento para o colaborador visualizar antes de assinar..."
                  value={form.document_html}
                  onChange={e => setForm(f => ({ ...f, document_html: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <span className="animate-spin mr-2">⟳</span> : <Send className="h-4 w-4 mr-2" />}
                Enviar para assinatura
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Documento</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Colaborador</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Enviado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Expira</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <PenLine className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400">Nenhuma assinatura encontrada</p>
                  </td>
                </tr>
              ) : filtered.map(sig => {
                const cfg = STATUS_CONFIG[sig.status] ?? STATUS_CONFIG.pending
                const Icon = cfg.icon
                const expired = new Date(sig.expires_at) < new Date() && sig.status === 'pending'
                return (
                  <tr key={sig.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900">{sig.document_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{sig.employee?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {DOC_TYPES.find(d => d.value === sig.document_type)?.label ?? sig.document_type}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        expired ? 'bg-gray-100 text-gray-500' : cfg.color
                      }`}>
                        <Icon className="h-3 w-3" />
                        {expired ? 'Expirado' : cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                      {new Date(sig.sent_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                      {new Date(sig.expires_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {sig.status === 'pending' && !expired && (
                          <Button variant="ghost" size="sm" onClick={() => copyLink(sig.token)}
                            title="Copiar link" className="text-gray-400 hover:text-blue-600">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => loadTrail(sig)}
                          title="Ver trilha de auditoria" className="text-gray-400 hover:text-purple-600">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal trilha de auditoria */}
      {trail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setTrail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">Trilha de auditoria</h3>
                <p className="text-sm text-gray-500">{trail.sig.document_name}</p>
              </div>
              <button onClick={() => setTrail(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {trail.events.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Nenhum evento registrado</p>
              ) : trail.events.map((ev: any, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      ev.event === 'signed'   ? 'bg-green-500' :
                      ev.event === 'rejected' ? 'bg-red-500' :
                      ev.event === 'viewed'   ? 'bg-blue-500' : 'bg-gray-400'
                    }`}>
                      {i + 1}
                    </div>
                    {i < trail.events.length - 1 && <div className="w-0.5 h-4 bg-gray-200 mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-semibold text-gray-800 capitalize">{ev.event}</p>
                    {ev.description && <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>}
                    {ev.ip && <p className="text-xs text-gray-400 font-mono">IP: {ev.ip}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(ev.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
              Colaborador: {trail.sig.employee?.full_name ?? '—'} · {trail.sig.employee?.email ?? '—'}
              {trail.sig.signed_at && (
                <><br />Assinado em: {new Date(trail.sig.signed_at).toLocaleString('pt-BR')}
                {trail.sig.signed_ip && ` · IP: ${trail.sig.signed_ip}`}</>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
