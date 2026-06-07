'use client'

import { useEffect, useState, useCallback } from 'react'
import { Megaphone, Plus, Eye, Trash2, Users, AlertTriangle, Info, Zap, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type Announcement = {
  id: string; title: string; content: string; type: string
  target_audience: string; is_active: boolean; expires_at: string | null
  created_at: string; target_department_id: string | null
  reads?: { count: number }[]
}
type Department = { id: string; name: string }

const TYPE_CONFIG = {
  info:    { label: 'Informativo', icon: Info,          color: 'bg-blue-100 text-blue-700 border-blue-200' },
  warning: { label: 'Atenção',     icon: AlertTriangle,  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  urgent:  { label: 'Urgente',     icon: Zap,            color: 'bg-red-100 text-red-700 border-red-200' },
}

const AUDIENCE_LABELS: Record<string, string> = {
  all:        'Todos os colaboradores',
  department: 'Departamento específico',
}

export default function ComunicadosPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [departments,   setDepartments]   = useState<Department[]>([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [viewReads,     setViewReads]     = useState<{ id: string; reads: any[] } | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [form, setForm] = useState({
    title: '', content: '', type: 'info',
    target_audience: 'all', target_department_id: '',
    expires_at: '', is_active: true,
  })

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return
    setLoading(true)
    const supabase = createClient()
    const [aRes, dRes] = await Promise.all([
      supabase.from('announcements')
        .select('*, reads:announcement_reads(count)')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false }),
      supabase.from('departments')
        .select('id, name')
        .eq('company_id', user.company_id)
        .order('name'),
    ])
    setAnnouncements((aRes.data as Announcement[]) ?? [])
    setDepartments((dRes.data as Department[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Título e conteúdo são obrigatórios')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('announcements').insert({
      company_id:          user!.company_id,
      title:               form.title.trim(),
      content:             form.content.trim(),
      type:                form.type,
      target_audience:     form.target_audience,
      target_department_id: form.target_audience === 'department' ? form.target_department_id || null : null,
      expires_at:          form.expires_at || null,
      is_active:           form.is_active,
      created_by:          user!.id,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao salvar comunicado'); return }
    toast.success('Comunicado criado com sucesso!')
    setShowForm(false)
    setForm({ title: '', content: '', type: 'info', target_audience: 'all', target_department_id: '', expires_at: '', is_active: true })
    load()
  }

  const handleToggle = async (id: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from('announcements').update({ is_active: !current }).eq('id', id)
    setAnnouncements(a => a.map(x => x.id === id ? { ...x, is_active: !current } : x))
    toast.success(current ? 'Comunicado desativado' : 'Comunicado ativado')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este comunicado?')) return
    const supabase = createClient()
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(a => a.filter(x => x.id !== id))
    toast.success('Comunicado excluído')
  }

  const loadReads = async (id: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('announcement_reads')
      .select('read_at, employee:employees(full_name)')
      .eq('announcement_id', id)
      .order('read_at')
    setViewReads({ id, reads: data ?? [] })
  }

  const active   = announcements.filter(a => a.is_active)
  const inactive = announcements.filter(a => !a.is_active)

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Megaphone className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comunicados Internos</h1>
            <p className="text-gray-500 text-sm">Avisos para toda a equipe ou grupos específicos</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo comunicado
        </Button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Novo comunicado</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Título *</Label>
                <Input placeholder="Ex: Reunião de equipe na sexta-feira" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  {(Object.entries(TYPE_CONFIG) as [string, typeof TYPE_CONFIG.info][]).map(([k, v]) => {
                    const Icon = v.icon
                    return (
                      <button key={k} type="button"
                        onClick={() => setForm(f => ({ ...f, type: k }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          form.type === k ? v.color : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" /> {v.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Destinatários</Label>
                <div className="flex gap-2">
                  {Object.entries(AUDIENCE_LABELS).map(([k, v]) => (
                    <button key={k} type="button"
                      onClick={() => setForm(f => ({ ...f, target_audience: k }))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        form.target_audience === k ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
                      }`}
                    >{v}</button>
                  ))}
                </div>
              </div>
              {form.target_audience === 'department' && (
                <div className="space-y-1.5">
                  <Label>Departamento</Label>
                  <select
                    value={form.target_department_id}
                    onChange={e => setForm(f => ({ ...f, target_department_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Válido até <span className="text-gray-400">(opcional)</span></Label>
                <Input type="date" value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Conteúdo *</Label>
                <textarea
                  rows={4}
                  placeholder="Digite o conteúdo do comunicado..."
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <span className="mr-2 animate-spin">⟳</span>}
                Publicar comunicado
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de comunicados ativos */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Ativos ({active.length})</h2>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : active.length === 0 ? (
          <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
            <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Nenhum comunicado ativo</p>
            <p className="text-gray-300 text-sm mt-1">Crie o primeiro comunicado da empresa</p>
          </div>
        ) : active.map(ann => {
          const cfg = TYPE_CONFIG[ann.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info
          const Icon = cfg.icon
          const readCount = ann.reads?.[0]?.count ?? 0
          const expired = ann.expires_at && new Date(ann.expires_at) < new Date()

          return (
            <div key={ann.id} className={`bg-white rounded-xl border p-5 ${expired ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shrink-0 ${cfg.color}`}>
                    <Icon className="h-3 w-3" /> {cfg.label}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{ann.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{ann.content}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {ann.target_audience === 'all' ? 'Todos' : 'Departamento'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {readCount} leitura{readCount !== 1 ? 's' : ''}
                      </span>
                      {ann.expires_at && (
                        <span className={expired ? 'text-red-400' : ''}>
                          {expired ? '⚠️ Expirado' : `Válido até ${new Date(ann.expires_at).toLocaleDateString('pt-BR')}`}
                        </span>
                      )}
                      <span>{new Date(ann.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => loadReads(ann.id)} title="Ver leituras">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(ann.id, ann.is_active)}
                    className="text-amber-500 hover:text-amber-700" title="Desativar">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(ann.id)}
                    className="text-red-400 hover:text-red-600" title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Inativos */}
      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Inativos ({inactive.length})</h2>
          {inactive.map(ann => {
            const cfg = TYPE_CONFIG[ann.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info
            return (
              <div key={ann.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">{ann.title}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(ann.id, ann.is_active)}
                      className="text-green-500 hover:text-green-700 text-xs">Reativar</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(ann.id)}
                      className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal leituras */}
      {viewReads && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setViewReads(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Confirmações de leitura</h3>
              <button onClick={() => setViewReads(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {viewReads.reads.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Nenhum colaborador leu ainda</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {viewReads.reads.map((r: any, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-800">{r.employee?.full_name ?? '—'}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(r.read_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3 text-center">
              {viewReads.reads.length} colaborador{viewReads.reads.length !== 1 ? 'es' : ''} leu este comunicado
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
