'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, CheckCircle2, AlertCircle, Clock, Loader2, RefreshCw, ExternalLink, Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type EventoStatus = 'pendente' | 'enviado' | 'processado' | 'erro' | 'retificado'

type EventoESocial = {
  id: string
  tipo: string
  descricao: string
  employee_id: string | null
  employee_name: string | null
  data_evento: string
  data_envio: string | null
  status: EventoStatus
  protocolo: string | null
  observacao: string | null
  created_at: string
}

const EVENTOS_TIPOS = [
  { code: 'S-1000', label: 'Informações do Empregador', group: 'Tabelas' },
  { code: 'S-1020', label: 'Lotações Tributárias',      group: 'Tabelas' },
  { code: 'S-1030', label: 'Cargos/Funções',            group: 'Tabelas' },
  { code: 'S-1035', label: 'Carreiras/Planos de Cargos',group: 'Tabelas' },
  { code: 'S-1040', label: 'Funções/Cargos em Comissão',group: 'Tabelas' },
  { code: 'S-1050', label: 'Horários de Trabalho',      group: 'Tabelas' },
  { code: 'S-1060', label: 'Ambientes de Trabalho',     group: 'Tabelas' },
  { code: 'S-1070', label: 'Processos Administrativos / Judiciais', group: 'Tabelas' },
  { code: 'S-2200', label: 'Admissão / Ingresso',       group: 'Não-Periódicos' },
  { code: 'S-2205', label: 'Alteração de Dados Cadastrais', group: 'Não-Periódicos' },
  { code: 'S-2206', label: 'Alteração de Contrato de Trabalho', group: 'Não-Periódicos' },
  { code: 'S-2210', label: 'Comunicação de Acidente de Trabalho (CAT)', group: 'Não-Periódicos' },
  { code: 'S-2220', label: 'Monitoramento da Saúde do Trabalhador', group: 'Não-Periódicos' },
  { code: 'S-2230', label: 'Afastamento Temporário',    group: 'Não-Periódicos' },
  { code: 'S-2240', label: 'Condições Amb. do Trabalho — Ag. Nocivos', group: 'Não-Periódicos' },
  { code: 'S-2298', label: 'Reintegração / Outros Provimentos', group: 'Não-Periódicos' },
  { code: 'S-2299', label: 'Desligamento',              group: 'Não-Periódicos' },
  { code: 'S-2300', label: 'Trabalhador Sem Vínculo — Início', group: 'Não-Periódicos' },
  { code: 'S-2399', label: 'Trabalhador Sem Vínculo — Término', group: 'Não-Periódicos' },
  { code: 'S-1200', label: 'Remuneração do Trabalhador', group: 'Periódicos' },
  { code: 'S-1202', label: 'Remuneração — Trabalhador Sem Vínculo', group: 'Periódicos' },
  { code: 'S-1207', label: 'Benefícios Previdenciários', group: 'Periódicos' },
  { code: 'S-1210', label: 'Pagamentos de Rendimentos do Trabalho', group: 'Periódicos' },
  { code: 'S-1260', label: 'Comercialização — Produtor Rural PF', group: 'Periódicos' },
  { code: 'S-1270', label: 'Contratação de Trabalhadores Avulsos', group: 'Periódicos' },
  { code: 'S-1280', label: 'Informações Complementares — Períodos Anteriores', group: 'Periódicos' },
  { code: 'S-1295', label: 'Solicitação de Totalização p/ Pagamento em Atraso', group: 'Periódicos' },
  { code: 'S-1300', label: 'Contribuição Sindical Patronal', group: 'Periódicos' },
]

const STATUS_META: Record<EventoStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendente:   { label: 'Pendente',   color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  enviado:    { label: 'Enviado',    color: 'bg-blue-100 text-blue-700',     icon: Clock },
  processado: { label: 'Processado', color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  erro:       { label: 'Erro',       color: 'bg-red-100 text-red-600',       icon: AlertCircle },
  retificado: { label: 'Retificado', color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item); if (!acc[k]) acc[k] = []; acc[k].push(item); return acc
  }, {} as Record<string, T[]>)
}

export default function ESocialPage() {
  const { user } = useAuth()
  const [eventos,   setEventos]   = useState<EventoESocial[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [addOpen,   setAddOpen]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterGrupo,  setFilterGrupo]  = useState<string>('')

  // Form
  const [fTipo,  setFTipo]  = useState('S-2200')
  const [fEmp,   setFEmp]   = useState('')
  const [fData,  setFData]  = useState(new Date().toISOString().slice(0,10))
  const [fStatus,setFStatus]= useState<EventoStatus>('pendente')
  const [fProto, setFProto] = useState('')
  const [fObs,   setFObs]   = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.company_id) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const [evRes, empRes] = await Promise.all([
      supabase.from('esocial_events').select('*').eq('company_id', user.company_id).order('data_evento', { ascending: false }),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).order('full_name'),
    ])
    setEventos((evRes.data ?? []) as EventoESocial[])
    setEmployees(empRes.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function saveEvento() {
    if (!fTipo || !fData) { toast.error('Preencha tipo e data'); return }
    setSaving(true)
    const supabase = createClient()
    const tipoMeta = EVENTOS_TIPOS.find(e => e.code === fTipo)
    const empName  = employees.find(e => e.id === fEmp)?.full_name ?? null
    const { error } = await supabase.from('esocial_events').insert({
      company_id:    user!.company_id,
      tipo:          fTipo,
      descricao:     tipoMeta?.label ?? fTipo,
      employee_id:   fEmp || null,
      employee_name: empName,
      data_evento:   fData,
      data_envio:    fStatus !== 'pendente' ? new Date().toISOString().slice(0,10) : null,
      status:        fStatus,
      protocolo:     fProto || null,
      observacao:    fObs || null,
    })
    if (error) {
      toast.error(error.message.includes('does not exist') ? 'Execute a migração SQL (20260628_esocial.sql)' : error.message)
    } else {
      toast.success('Evento registrado!'); setAddOpen(false); setFProto(''); setFObs(''); load()
    }
    setSaving(false)
  }

  async function updateStatus(id: string, status: EventoStatus) {
    const supabase = createClient()
    await supabase.from('esocial_events').update({
      status, data_envio: status !== 'pendente' ? new Date().toISOString().slice(0,10) : null,
    }).eq('id', id)
    setEventos(prev => prev.map(e => e.id === id ? { ...e, status, data_envio: new Date().toISOString().slice(0,10) } : e))
    toast.success('Status atualizado')
  }

  function exportCSV() {
    const rows = eventos.map(e => [e.tipo, e.descricao, e.employee_name ?? '', e.data_evento, e.status, e.protocolo ?? '', e.observacao ?? ''])
    const csv  = ['Tipo,Descrição,Colaborador,Data Evento,Status,Protocolo,Observação', ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n')
    const a    = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿'+csv], { type: 'text/csv' })); a.download = 'esocial.csv'; a.click()
  }

  const filtered = eventos.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false
    if (filterGrupo) {
      const g = EVENTOS_TIPOS.find(t => t.code === e.tipo)?.group
      if (g !== filterGrupo) return false
    }
    return true
  })

  const totalPend  = eventos.filter(e => e.status === 'pendente').length
  const totalErro  = eventos.filter(e => e.status === 'erro').length
  const totalOk    = eventos.filter(e => e.status === 'processado').length

  const grupos = Array.from(new Set(EVENTOS_TIPOS.map(e => e.group)))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> e-Social
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Controle de eventos e obrigações acessórias</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}><Download className="h-3.5 w-3.5" /> CSV</Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" /> Registrar evento</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`border rounded-xl p-4 ${totalPend > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-white'}`}>
          <p className="text-xs uppercase tracking-wide text-gray-400">Pendentes</p>
          <p className={`text-3xl font-bold mt-1 ${totalPend > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{totalPend}</p>
        </div>
        <div className={`border rounded-xl p-4 ${totalErro > 0 ? 'bg-red-50 border-red-100' : 'bg-white'}`}>
          <p className="text-xs uppercase tracking-wide text-gray-400">Com erro</p>
          <p className={`text-3xl font-bold mt-1 ${totalErro > 0 ? 'text-red-600' : 'text-gray-400'}`}>{totalErro}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Processados</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{totalOk}</p>
        </div>
      </div>

      {/* Aviso informativo */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
        <Shield className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold">Módulo de controle manual</p>
          <p className="text-blue-600 mt-0.5">Este painel registra e acompanha o status dos eventos eSocial. Para transmissão ao governo federal, utilize o portal do eSocial ou software homologado pela RFB. <a href="https://esocial.fazenda.gov.br" target="_blank" rel="noreferrer" className="underline">Portal eSocial →</a></p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background h-8">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterGrupo} onChange={e => setFilterGrupo(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background h-8">
          <option value="">Todos os grupos</option>
          {grupos.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white text-xs uppercase">
                <th className="text-left px-4 py-3">Evento</th>
                <th className="text-left px-4 py-3">Descrição</th>
                <th className="text-left px-4 py-3">Colaborador</th>
                <th className="text-left px-4 py-3">Data evento</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum evento registrado</p>
                </td></tr>
              ) : filtered.map((e, ri) => {
                const meta = STATUS_META[e.status]
                const Icon = meta.icon
                return (
                  <tr key={e.id} className={`border-b ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/30`}>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{e.tipo}</td>
                    <td className="px-4 py-3 text-gray-700">{e.descricao}</td>
                    <td className="px-4 py-3 text-gray-500">{e.employee_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(e.data_evento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{e.protocolo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={e.status}
                        onChange={ev => updateStatus(e.id, ev.target.value as EventoStatus)}
                        className="text-xs border rounded px-1.5 py-0.5 bg-background"
                      >
                        {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal novo evento */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar evento eSocial</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Tipo de evento *</Label>
              <select value={fTipo} onChange={e => setFTipo(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                {grupos.map(g => (
                  <optgroup key={g} label={g}>
                    {EVENTOS_TIPOS.filter(e => e.group === g).map(e => (
                      <option key={e.code} value={e.code}>{e.code} — {e.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Colaborador (se aplicável)</Label>
              <select value={fEmp} onChange={e => setFEmp(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Não se aplica</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Data do evento *</Label>
                <input type="date" value={fData} onChange={e => setFData(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1.5"><Label>Status *</Label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value as EventoStatus)} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Número do protocolo</Label>
              <input value={fProto} onChange={e => setFProto(e.target.value)} placeholder="Ex: 1.2.3.4567890-8" className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1.5"><Label>Observação</Label>
              <input value={fObs} onChange={e => setFObs(e.target.value)} placeholder="Opcional" className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={saveEvento} disabled={saving} className="flex-1">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Registrar</Button>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
