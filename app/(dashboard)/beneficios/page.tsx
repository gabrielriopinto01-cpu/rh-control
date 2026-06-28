'use client'

import { useEffect, useState, useCallback } from 'react'
import { Gift, Plus, Pencil, Trash2, Users, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  vt:            { label: 'Vale-Transporte', color: 'bg-blue-100 text-blue-700' },
  vr:            { label: 'Vale-Refeição',   color: 'bg-orange-100 text-orange-700' },
  health:        { label: 'Plano de Saúde',  color: 'bg-green-100 text-green-700' },
  dental:        { label: 'Plano Odonto',    color: 'bg-teal-100 text-teal-700' },
  life_insurance:{ label: 'Seguro de Vida',  color: 'bg-purple-100 text-purple-700' },
  gym:           { label: 'Academia/Gym',    color: 'bg-pink-100 text-pink-700' },
  other:         { label: 'Outro',           color: 'bg-gray-100 text-gray-700' },
}

type Benefit = {
  id: string; name: string; type: string; description?: string
  value?: number; employee_discount?: number; active: boolean
}

type Form = {
  name: string; type: string; description: string
  value: string; employee_discount: string; active: boolean
}

const blank = (): Form => ({ name: '', type: 'vt', description: '', value: '', employee_discount: '', active: true })

function brl(n?: number | null) {
  if (n == null) return null
  return `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export default function BeneficiosPage() {
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [loading,  setLoading]  = useState(true)
  const [dialog,   setDialog]   = useState(false)
  const [editing,  setEditing]  = useState<Benefit | null>(null)
  const [form,     setForm]     = useState<Form>(blank)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/benefits')
    if (res.ok) setBenefits(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm(blank()); setDialog(true) }
  function openEdit(b: Benefit) {
    setEditing(b)
    setForm({
      name: b.name, type: b.type, description: b.description ?? '',
      value: b.value != null ? String(b.value) : '',
      employee_discount: b.employee_discount != null ? String(b.employee_discount) : '',
      active: b.active,
    })
    setDialog(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.type) { toast.error('Nome e tipo obrigatórios'); return }

    const payload = {
      name: form.name, type: form.type,
      description: form.description || null,
      value: form.value ? parseFloat(form.value.replace(',', '.')) : null,
      employee_discount: form.employee_discount ? parseFloat(form.employee_discount.replace(',', '.')) : null,
      active: form.active,
    }

    const res = editing
      ? await fetch(`/api/benefits/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/benefits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

    if (!res.ok) { toast.error('Erro ao salvar'); return }
    toast.success(editing ? 'Benefício atualizado!' : 'Benefício criado!')
    setDialog(false); load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este benefício?')) return
    const res = await fetch(`/api/benefits/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Erro ao excluir'); return }
    toast.success('Benefício excluído'); load()
  }

  async function toggleActive(b: Benefit) {
    await fetch(`/api/benefits/${b.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !b.active }),
    })
    load()
  }

  const active   = benefits.filter(b => b.active)
  const inactive = benefits.filter(b => !b.active)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gift className="h-6 w-6" /> Benefícios</h1>
          <p className="text-muted-foreground text-sm mt-1">Catálogo de benefícios da empresa</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo benefício</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700">{benefits.length}</p>
          <p className="text-sm text-blue-600">Total</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">{active.length}</p>
          <p className="text-sm text-green-600">Ativos</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-700">{inactive.length}</p>
          <p className="text-sm text-gray-600">Inativos</p>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : benefits.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground">
          <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum benefício cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {benefits.map(b => {
            const tc = TYPE_LABELS[b.type] ?? TYPE_LABELS.other!
            return (
              <div key={b.id} className={`bg-card border rounded-xl p-4 space-y-3 ${!b.active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{b.name}</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${tc.color}`}>{tc.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(b)} className="p-1 rounded hover:bg-muted text-muted-foreground" title={b.active ? 'Desativar' : 'Ativar'}>
                      {b.active ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button onClick={() => openEdit(b)} className="p-1 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(b.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {b.description && <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>}

                <div className="flex gap-3 text-sm">
                  {b.value != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Valor empresa</p>
                      <p className="font-medium">{brl(b.value)}</p>
                    </div>
                  )}
                  {b.employee_discount != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Desconto colab.</p>
                      <p className="font-medium text-orange-600">{brl(b.employee_discount)}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar benefício' : 'Novo benefício'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Vale-Transporte Diário" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                {Object.entries(TYPE_LABELS).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor empresa (R$)</Label>
                <Input placeholder="0,00" value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Desconto colab. (R$)</Label>
                <Input placeholder="0,00" value={form.employee_discount}
                  onChange={e => setForm(f => ({ ...f, employee_discount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} placeholder="Detalhes do benefício..." value={form.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
              <Label htmlFor="active">Ativo</Label>
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
