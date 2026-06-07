'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, Search, Filter, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type AuditLog = {
  id:          string
  user_email:  string | null
  user_role:   string | null
  action:      string
  resource:    string
  resource_id: string | null
  description: string | null
  created_at:  string
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN:  'bg-purple-100 text-purple-700',
  EXPORT: 'bg-amber-100 text-amber-700',
}

const RESOURCE_LABELS: Record<string, string> = {
  employees:    'Colaboradores',
  payroll_runs: 'Folha de Pagamento',
  vacations:    'Férias',
  attendance:   'Ponto',
  documents:    'Documentos',
  departments:  'Departamentos',
  positions:    'Cargos',
  settings:     'Configurações',
}

export default function AuditLogPage() {
  const { user }   = useAuth()
  const [logs,     setLogs]     = useState<AuditLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [resource, setResource] = useState('all')
  const [action,   setAction]   = useState('all')
  const [page,     setPage]     = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return
    setLoading(true)
    const supabase = createClient()
    let q = supabase
      .from('audit_logs')
      .select('id, user_email, user_role, action, resource, resource_id, description, created_at')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (resource !== 'all') q = q.eq('resource', resource)
    if (action   !== 'all') q = q.eq('action',   action)

    const { data } = await q
    setLogs(l => page === 0 ? (data as AuditLog[] ?? []) : [...l, ...(data as AuditLog[] ?? [])])
    setLoading(false)
  }, [user, resource, action, page])

  useEffect(() => { setPage(0) }, [resource, action])
  useEffect(() => { load() }, [load])

  const filtered = search
    ? logs.filter(l =>
        l.user_email?.toLowerCase().includes(search.toLowerCase()) ||
        l.description?.toLowerCase().includes(search.toLowerCase()) ||
        l.resource.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  const exportCSV = () => {
    const bom = '﻿'
    const header = 'Data/Hora;Usuário;Perfil;Ação;Recurso;Descrição\n'
    const lines = filtered.map(l =>
      `"${new Date(l.created_at).toLocaleString('pt-BR')}";"${l.user_email ?? '—'}";"${l.user_role ?? '—'}";"${l.action}";"${RESOURCE_LABELS[l.resource] ?? l.resource}";"${l.description ?? ''}"`
    ).join('\n')
    const blob = new Blob([bom + header + lines], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Shield className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Log de Auditoria</h1>
            <p className="text-gray-500 text-sm">Rastreio completo de todas as ações no sistema</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setPage(0); load() }}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por usuário ou descrição..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={resource} onChange={e => setResource(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
        >
          <option value="all">Todos os recursos</option>
          {Object.entries(RESOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={action} onChange={e => setAction(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
        >
          <option value="all">Todas as ações</option>
          {['CREATE','UPDATE','DELETE','LOGIN','EXPORT'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Data/Hora</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Perfil</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ação</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Recurso</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && page === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Carregando logs...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Shield className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">Nenhum log encontrado</p>
                    <p className="text-gray-300 text-xs mt-1">Os logs aparecem aqui conforme ações são realizadas no sistema</p>
                  </td>
                </tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR', {
                      day:'2-digit', month:'2-digit', year:'numeric',
                      hour:'2-digit', minute:'2-digit'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{log.user_email ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize hidden sm:table-cell">
                    {log.user_role ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'
                    }`}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {RESOURCE_LABELS[log.resource] ?? log.resource}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {log.description ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {filtered.length >= PAGE_SIZE && (
          <div className="border-t border-gray-200 p-4 text-center">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={loading}>
              {loading ? 'Carregando...' : 'Carregar mais'}
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Exibindo {filtered.length} registros · Logs são mantidos por 90 dias
      </p>
    </div>
  )
}
