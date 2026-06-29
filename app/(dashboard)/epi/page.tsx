'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  HardHat, Plus, Pencil, Trash2, Package, AlertTriangle,
  CheckCircle2, Clock, Loader2, Search, ArrowLeftRight, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type EpiItem = {
  id: string; name: string; ca_number?: string; description?: string
  unit: string; stock: number; min_stock: number; validity_months?: number
}
type Delivery = {
  id: string; epi_id: string; employee_id: string; delivery_date: string
  quantity: number; expiry_date?: string; return_date?: string; condition: string; notes?: string
  employee?: { full_name: string }
  epi?: { name: string; ca_number?: string; unit: string; validity_months?: number }
}
type Employee = { id: string; full_name: string }

const CONDITION: Record<string, { label: string; color: string }> = {
  new:     { label: 'Novo',      color: 'bg-green-100 text-green-700' },
  good:    { label: 'Bom',       color: 'bg-blue-100 text-blue-700' },
  damaged: { label: 'Danificado',color: 'bg-orange-100 text-orange-700' },
  lost:    { label: 'Extraviado',color: 'bg-red-100 text-red-700' },
}

function brl(n: number) { return `R$ ${n.toFixed(2).replace('.', ',')}` }
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}
function isExpired(d?: string | null) {
  if (!d) return false
  return new Date(d + 'T00:00:00') < new Date()
}
function isExpiringSoon(d?: string | null) {
  if (!d) return false
  const dt = new Date(d + 'T00:00:00')
  const in30 = new Date(Date.now() + 30 * 86400000)
  return dt >= new Date() && dt <= in30
}

export default function EpiPage() {
  const { user } = useAuth()
  const [tab,        setTab]        = useState<'estoque' | 'entregas'>('estoque')
  const [items,      setItems]      = useState<EpiItem[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')

  // Dialogs
  const [itemDialog,     setItemDialog]     = useState(false)
  const [delivDialog,    setDelivDialog]    = useState(false)
  const [editingItem,    setEditingItem]    = useState<EpiItem | null>(null)

  // Forms
  const blankItem = () => ({ name: '', ca_number: '', description: '', unit: 'unidade', stock: '', min_stock: '0', validity_months: '' })
  const blankDeliv = () => ({ epi_id: '', employee_id: '', delivery_date: new Date().toISOString().slice(0, 10), quantity: '1', notes: '', condition: 'new' })
  const [itemForm,  setItemForm]  = useState(blankItem())
  const [delivForm, setDelivForm] = useState(blankDeliv())
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const sb = createClient()
    const [iRes, dRes, eRes] = await Promise.allSettled([
      sb.from('epi_items').select('*').eq('company_id', user.company_id).order('name'),
      sb.from('epi_deliveries')
        .select('*, employee:employees(full_name), epi:epi_items(name, ca_number, unit, validity_months)')
        .eq('company_id', user.company_id)
        .order('delivery_date', { ascending: false })
        .limit(200),
      sb.from('employees').select('id, full_name').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])
    if (iRes.status === 'fulfilled') setItems((iRes.value.data ?? []) as EpiItem[])
    if (dRes.status === 'fulfilled') setDeliveries((dRes.value.data ?? []) as Delivery[])
    if (eRes.status === 'fulfilled') setEmployees((eRes.value.data ?? []) as Employee[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ─── Salvar EPI item ──────────────────────────────────────────
  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemForm.name.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      company_id: user!.company_id,
      name: itemForm.name.trim(),
      ca_number: itemForm.ca_number || null,
      description: itemForm.description || null,
      unit: itemForm.unit,
      stock: Number(itemForm.stock) || 0,
      min_stock: Number(itemForm.min_stock) || 0,
      validity_months: itemForm.validity_months ? Number(itemForm.validity_months) : null,
    }
    const { error } = editingItem
      ? await sb.from('epi_items').update(payload).eq('id', editingItem.id)
      : await sb.from('epi_items').insert(payload)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success(editingItem ? 'EPI atualizado' : 'EPI cadastrado')
    setItemDialog(false); setEditingItem(null); load()
  }

  // ─── Salvar entrega ───────────────────────────────────────────
  const saveDelivery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!delivForm.epi_id || !delivForm.employee_id) { toast.error('Selecione EPI e colaborador'); return }
    const epi = items.find(i => i.id === delivForm.epi_id)
    setSaving(true)
    const sb = createClient()

    // Calcula data de validade
    let expiryDate: string | null = null
    if (epi?.validity_months) {
      const d = new Date(delivForm.delivery_date + 'T00:00:00')
      d.setMonth(d.getMonth() + epi.validity_months)
      expiryDate = d.toISOString().slice(0, 10)
    }

    const { error } = await sb.from('epi_deliveries').insert({
      company_id: user!.company_id,
      epi_id: delivForm.epi_id,
      employee_id: delivForm.employee_id,
      delivery_date: delivForm.delivery_date,
      quantity: Number(delivForm.quantity) || 1,
      expiry_date: expiryDate,
      notes: delivForm.notes || null,
      condition: delivForm.condition,
      delivered_by: user!.id,
    })

    if (!error) {
      // Debita do estoque
      const qty = Number(delivForm.quantity) || 1
      await sb.from('epi_items').update({ stock: Math.max(0, (epi?.stock ?? 0) - qty) }).eq('id', delivForm.epi_id)
    }

    setSaving(false)
    if (error) { toast.error('Erro ao registrar entrega'); return }
    toast.success('Entrega registrada!')
    setDelivDialog(false); setDelivForm(blankDeliv()); load()
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Excluir este EPI? As entregas relacionadas também serão excluídas.')) return
    const { error } = await createClient().from('epi_items').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('EPI removido'); load()
  }

  const registerReturn = async (d: Delivery) => {
    const { error } = await createClient().from('epi_deliveries')
      .update({ return_date: new Date().toISOString().slice(0, 10) }).eq('id', d.id)
    if (error) { toast.error('Erro ao registrar devolução'); return }
    // Credita de volta no estoque
    await createClient().from('epi_items')
      .update({ stock: (items.find(i => i.id === d.epi_id)?.stock ?? 0) + d.quantity })
      .eq('id', d.epi_id)
    toast.success('Devolução registrada'); load()
  }

  // CSV export de entregas
  const exportCsv = () => {
    const rows = [['Colaborador','EPI','CA','Data entrega','Validade','Qtd','Status','Devolvido']]
    deliveries.forEach(d => {
      const returned = d.return_date ? 'Sim' : 'Não'
      const status   = d.return_date ? 'Devolvido' : isExpired(d.expiry_date) ? 'Vencido' : isExpiringSoon(d.expiry_date) ? 'Vence em 30d' : 'Em uso'
      rows.push([
        (d.employee as any)?.full_name ?? '',
        (d.epi as any)?.name ?? '',
        (d.epi as any)?.ca_number ?? '',
        fmtDate(d.delivery_date),
        fmtDate(d.expiry_date),
        String(d.quantity),
        status,
        returned,
      ])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `epi_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
  const activeDeliveries = deliveries.filter(d => !d.return_date)
  const expiredCount     = activeDeliveries.filter(d => isExpired(d.expiry_date)).length
  const expiringSoon     = activeDeliveries.filter(d => isExpiringSoon(d.expiry_date)).length
  const lowStock         = items.filter(i => i.stock <= i.min_stock && i.min_stock > 0).length

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardHat className="h-6 w-6" /> Controle de EPI
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Equipamentos de Proteção Individual — NR-6 / CLT Art. 166
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setDelivForm(blankDeliv()); setDelivDialog(true) }}>
            <ArrowLeftRight className="h-4 w-4 mr-2" /> Registrar entrega
          </Button>
          <Button onClick={() => { setEditingItem(null); setItemForm(blankItem()); setItemDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Novo EPI
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'EPIs cadastrados',  value: items.length,         Icon: Package,        color: 'text-gray-700' },
          { label: 'Em uso',            value: activeDeliveries.length, Icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Vencidos',          value: expiredCount,         Icon: AlertTriangle,  color: 'text-red-600' },
          { label: 'Estoque crítico',   value: lowStock,             Icon: AlertTriangle,  color: 'text-orange-500' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-card border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 flex items-center gap-1.5 ${color}`}>
              {value} <Icon className="h-5 w-5" />
            </p>
          </div>
        ))}
      </div>

      {expiringSoon > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          <span><strong>{expiringSoon} EPI(s)</strong> vencem nos próximos 30 dias — revise as entregas abaixo.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['estoque', 'Estoque / Cadastro'], ['entregas', 'Histórico de Entregas']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{label}</button>
        ))}
      </div>

      {/* ─── Aba Estoque ─────────────────────────────────────── */}
      {tab === 'estoque' && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar EPI..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium">EPI</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">CA</th>
                  <th className="text-left px-4 py-3 font-medium">Estoque</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Validade</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{item.ca_number ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${item.stock <= item.min_stock && item.min_stock > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {item.stock}
                        </span>
                        <span className="text-muted-foreground text-xs">{item.unit}</span>
                        {item.stock <= item.min_stock && item.min_stock > 0 && (
                          <Badge className="bg-red-100 text-red-700 text-xs">Crítico</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {item.validity_months ? `${item.validity_months} meses` : '—'}
                    </td>
                    <td className="px-4 py-3 flex gap-1 justify-end">
                      <button onClick={() => {
                        setEditingItem(item)
                        setItemForm({
                          name: item.name, ca_number: item.ca_number ?? '',
                          description: item.description ?? '', unit: item.unit,
                          stock: String(item.stock), min_stock: String(item.min_stock),
                          validity_months: item.validity_months ? String(item.validity_months) : '',
                        })
                        setItemDialog(true)
                      }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteItem(item.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    {search ? 'Nenhum EPI encontrado' : 'Nenhum EPI cadastrado'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Aba Entregas ────────────────────────────────────── */}
      {tab === 'entregas' && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium">Colaborador</th>
                  <th className="text-left px-4 py-3 font-medium">EPI</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Entrega</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliveries.map(d => {
                  const returned = !!d.return_date
                  const expired  = !returned && isExpired(d.expiry_date)
                  const soon     = !returned && !expired && isExpiringSoon(d.expiry_date)
                  return (
                    <tr key={d.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{(d.employee as any)?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <p>{(d.epi as any)?.name ?? '—'}</p>
                        {(d.epi as any)?.ca_number && (
                          <p className="text-xs text-muted-foreground">CA {(d.epi as any).ca_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {fmtDate(d.delivery_date)} · {d.quantity}x
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={expired ? 'text-red-600 font-medium' : soon ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                          {fmtDate(d.expiry_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {returned  && <Badge className="bg-gray-100 text-gray-600">Devolvido</Badge>}
                        {expired   && <Badge className="bg-red-100 text-red-700">Vencido</Badge>}
                        {soon      && <Badge className="bg-amber-100 text-amber-700">Vence em breve</Badge>}
                        {!returned && !expired && !soon && <Badge className="bg-green-100 text-green-700">Em uso</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {!returned && (
                          <button onClick={() => registerReturn(d)}
                            className="text-xs text-indigo-600 hover:underline whitespace-nowrap">
                            Registrar devolução
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {deliveries.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    Nenhuma entrega registrada
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Dialog: EPI ─────────────────────────────────────── */}
      <Dialog open={itemDialog} onOpenChange={v => { setItemDialog(v); if (!v) setEditingItem(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? 'Editar EPI' : 'Novo EPI'}</DialogTitle></DialogHeader>
          <form onSubmit={saveItem} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Capacete de segurança" value={itemForm.name}
                onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nº CA (MTE)</Label>
                <Input placeholder="Ex: 12345" value={itemForm.ca_number}
                  onChange={e => setItemForm(f => ({ ...f, ca_number: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Input placeholder="unidade, par, kit..." value={itemForm.unit}
                  onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Estoque</Label>
                <Input type="number" min="0" value={itemForm.stock}
                  onChange={e => setItemForm(f => ({ ...f, stock: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Mínimo</Label>
                <Input type="number" min="0" value={itemForm.min_stock}
                  onChange={e => setItemForm(f => ({ ...f, min_stock: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Validade (meses)</Label>
                <Input type="number" min="1" placeholder="—" value={itemForm.validity_months}
                  onChange={e => setItemForm(f => ({ ...f, validity_months: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} value={itemForm.description}
                onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setItemDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingItem ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Entrega ─────────────────────────────────── */}
      <Dialog open={delivDialog} onOpenChange={setDelivDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar entrega de EPI</DialogTitle></DialogHeader>
          <form onSubmit={saveDelivery} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>EPI *</Label>
              <Select value={delivForm.epi_id} onValueChange={v => setDelivForm(f => ({ ...f, epi_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o EPI" /></SelectTrigger>
                <SelectContent>
                  {items.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} {i.ca_number ? `(CA ${i.ca_number})` : ''} — estoque: {i.stock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Colaborador *</Label>
              <Select value={delivForm.employee_id} onValueChange={v => setDelivForm(f => ({ ...f, employee_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de entrega *</Label>
                <Input type="date" value={delivForm.delivery_date}
                  onChange={e => setDelivForm(f => ({ ...f, delivery_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={delivForm.quantity}
                  onChange={e => setDelivForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Condição</Label>
              <Select value={delivForm.condition} onValueChange={v => setDelivForm(f => ({ ...f, condition: v ?? 'new' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={delivForm.notes}
                onChange={e => setDelivForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDelivDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar entrega
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
