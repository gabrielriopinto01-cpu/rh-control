'use client'

import { useEffect, useState, useCallback } from 'react'
import { GraduationCap, Plus, Trash2, Loader2, Video, FileText, Link2, Users, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Training, TrainingContentType } from '@/types/database'

export const dynamic = 'force-dynamic'

const TYPE_META: Record<TrainingContentType, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  video: { label: 'Vídeo', Icon: Video },
  pdf:   { label: 'PDF',   Icon: FileText },
  link:  { label: 'Link',  Icon: Link2 },
}

type FormState = { title: string; description: string; content_type: TrainingContentType; content_url: string }

export default function TreinamentosPage() {
  const { user } = useAuth()
  const [trainings, setTrainings] = useState<Training[]>([])
  const [counts,    setCounts]    = useState<Record<string, number>>({})
  const [loading,   setLoading]   = useState(true)
  const [dialog,    setDialog]    = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const blank = (): FormState => ({ title: '', description: '', content_type: 'video', content_url: '' })
  const [form, setForm] = useState<FormState>(blank)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [tRes, cRes] = await Promise.all([
      supabase.from('trainings').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false }),
      supabase.from('training_completions').select('training_id').eq('company_id', user.company_id),
    ])
    setTrainings((tRes.data as Training[]) ?? [])
    const map: Record<string, number> = {}
    for (const c of (cRes.data ?? [])) map[c.training_id] = (map[c.training_id] ?? 0) + 1
    setCounts(map)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditingId(null); setForm(blank()); setDialog(true) }
  const openEdit = (t: Training) => {
    setEditingId(t.id)
    setForm({ title: t.title, description: t.description ?? '', content_type: t.content_type, content_url: t.content_url ?? '' })
    setDialog(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!form.title) { toast.error('Informe o título'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      company_id: user.company_id, title: form.title, description: form.description || null,
      content_type: form.content_type, content_url: form.content_url || null,
    }
    const { error } = editingId
      ? await supabase.from('trainings').update(payload).eq('id', editingId)
      : await supabase.from('trainings').insert({ ...payload, created_by: user.id })
    setSaving(false)
    if (error) { toast.error('Erro ao salvar treinamento'); return }
    toast.success(editingId ? 'Treinamento atualizado!' : 'Treinamento criado!')
    setDialog(false); setEditingId(null); setForm(blank())
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este treinamento?')) return
    const supabase = createClient()
    const { error } = await supabase.from('trainings').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Treinamento excluído')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Treinamentos</h1>
          <p className="text-gray-500 mt-1">Cursos, materiais e certificações da equipe</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo treinamento</Button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400">Carregando...</div>
      ) : trainings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GraduationCap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhum treinamento cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trainings.map(t => {
            const { label, Icon } = TYPE_META[t.content_type]
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-gray-600 p-1"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mt-3">{t.title}</h3>
                {t.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
                  <span>{label}</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {counts[t.id] ?? 0} concluíram</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> {editingId ? 'Editar' : 'Novo'} treinamento</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Segurança no trabalho" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de conteúdo</Label>
                <Select value={form.content_type} onValueChange={(v) => setForm(f => ({ ...f, content_type: (v ?? 'video') as TrainingContentType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>URL do conteúdo</Label>
              <Input value={form.content_url} onChange={e => setForm(f => ({ ...f, content_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
