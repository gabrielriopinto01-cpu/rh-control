'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Globe, Building2, Users, UserCheck, CreditCard, Ban, Loader2, ShieldX,
  CheckCircle2, ChevronDown, RefreshCw, TrendingUp, DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PLANS = ['free', 'starter', 'pro', 'enterprise'] as const
const PLAN_LABEL: Record<string, string> = {
  free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
}
const PLAN_COLOR: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

type Company = {
  id: string; name: string; plan: string; status: string; created_at: string
  users: number; employees: number
}
type Overview = {
  totals: { companies: number; active: number; blocked: number; users: number; employees: number; paid: number }
  companies: Company[]
}

export default function SuperAdminPage() {
  const [data,    setData]    = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied,  setDenied]  = useState(false)
  const [busy,    setBusy]    = useState<string | null>(null)
  const [search,  setSearch]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/overview')
      if (res.status === 403 || res.status === 401) { setDenied(true); setLoading(false); return }
      setData(await res.json())
    } catch { setDenied(true) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const patchCompany = async (companyId: string, action: string, extra?: object) => {
    setBusy(companyId)
    const res = await fetch('/api/admin/company', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, action, ...extra }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Erro'); setBusy(null); return }
    toast.success('Atualizado com sucesso')
    await load()
    setBusy(null)
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  if (denied || !data) return (
    <div className="p-12 text-center">
      <ShieldX className="h-12 w-12 text-red-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Acesso restrito</p>
      <p className="text-sm text-gray-400 mt-1">Esta área é exclusiva dos administradores da plataforma GRP.</p>
    </div>
  )

  const t = data.totals
  const filtered = data.companies.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const revenue = {
    starter:    data.companies.filter(c => c.plan === 'starter').length * 197,
    pro:        data.companies.filter(c => c.plan === 'pro').length * 397,
    enterprise: data.companies.filter(c => c.plan === 'enterprise').length * 997,
  }
  const mrr = revenue.starter + revenue.pro + revenue.enterprise

  const kpis = [
    { label: 'Empresas',      value: t.companies, Icon: Building2,   color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Ativas',        value: t.active,    Icon: UserCheck,   color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Bloqueadas',    value: t.blocked,   Icon: Ban,         color: 'text-red-600',    bg: 'bg-red-50' },
    { label: 'Planos pagos',  value: t.paid,      Icon: CreditCard,  color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Usuários',      value: t.users,     Icon: Users,       color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Colaboradores', value: t.employees, Icon: TrendingUp,  color: 'text-teal-600',   bg: 'bg-teal-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-6 w-6 text-blue-600" /> Super Admin — GRP Tecnologia
          </h1>
          <p className="text-gray-500 mt-1">Visão global de todas as empresas da plataforma</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* MRR Estimado */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl p-5 text-white flex items-center justify-between">
        <div>
          <p className="text-indigo-200 text-sm">MRR Estimado</p>
          <p className="text-3xl font-bold mt-0.5">
            {mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-indigo-200 text-xs mt-1">
            Starter: {revenue.starter.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} &nbsp;·&nbsp;
            Pro: {revenue.pro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} &nbsp;·&nbsp;
            Enterprise: {revenue.enterprise.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <DollarSign className="h-12 w-12 text-white/20" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <Icon className={`h-5 w-5 ${color}`} />
            <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabela de empresas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <h2 className="font-semibold text-gray-800">Empresas ({data.companies.length})</h2>
          <input
            type="text"
            placeholder="Buscar empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Empresa', 'Plano', 'Status', 'Usuários', 'Colaboradores', 'Cadastro', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLOR[c.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                      {PLAN_LABEL[c.plan] ?? c.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                      {c.status === 'active' ? 'Ativa' : 'Bloqueada'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.users}</td>
                  <td className="px-4 py-3 text-gray-600">{c.employees}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at.slice(0, 10))}</td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={busy === c.id} className="gap-1 h-7">
                          {busy === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Ações <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Plano</DropdownMenuLabel>
                        {PLANS.map(p => (
                          <DropdownMenuItem key={p} onClick={() => patchCompany(c.id, 'set_plan', { plan: p })}
                            className={c.plan === p ? 'font-semibold text-indigo-600' : ''}>
                            {PLAN_LABEL[p]}
                            {c.plan === p && ' ✓'}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Status</DropdownMenuLabel>
                        {c.status === 'active' ? (
                          <DropdownMenuItem onClick={() => patchCompany(c.id, 'block')}
                            className="text-red-600 focus:text-red-700">
                            <Ban className="h-4 w-4 mr-2" /> Bloquear empresa
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => patchCompany(c.id, 'activate')}
                            className="text-green-600 focus:text-green-700">
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Reativar empresa
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma empresa encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
