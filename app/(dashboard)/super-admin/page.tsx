'use client'

import { useEffect, useState } from 'react'
import { Globe, Building2, Users, UserCheck, CreditCard, Ban, Loader2, ShieldX } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Company = {
  id: string; name: string; plan: string; status: string; created_at: string
  users: number; employees: number
}
type Overview = {
  totals: { companies: number; active: number; blocked: number; users: number; employees: number; paid: number }
  companies: Company[]
}

const PLAN_LABEL: Record<string, string> = { free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }

export default function SuperAdminPage() {
  const [data,    setData]    = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied,  setDenied]  = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/overview')
        if (res.status === 403 || res.status === 401) { setDenied(true); setLoading(false); return }
        const json = await res.json()
        setData(json)
      } catch { setDenied(true) }
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  if (denied || !data) return (
    <div className="p-12 text-center">
      <ShieldX className="h-12 w-12 text-red-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Acesso restrito</p>
      <p className="text-sm text-gray-400 mt-1">Esta área é exclusiva dos administradores da plataforma.</p>
    </div>
  )

  const t = data.totals
  const cards = [
    { label: 'Empresas',     value: t.companies, Icon: Building2,  color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Ativas',       value: t.active,    Icon: UserCheck,  color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Bloqueadas',   value: t.blocked,   Icon: Ban,        color: 'text-red-600',    bg: 'bg-red-50' },
    { label: 'Planos pagos', value: t.paid,      Icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Usuários',     value: t.users,     Icon: Users,      color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Colaboradores',value: t.employees, Icon: Users,      color: 'text-teal-600',   bg: 'bg-teal-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Globe className="h-6 w-6 text-blue-600" /> Super Admin — GRP</h1>
        <p className="text-gray-500 mt-1">Visão global de todas as empresas da plataforma</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <Icon className={`h-5 w-5 ${color}`} />
            <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Empresa','Plano','Status','Usuários','Colaboradores','Cadastro'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.companies.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {PLAN_LABEL[c.plan] ?? c.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.status === 'active' ? 'Ativa' : 'Bloqueada'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.users}</td>
                <td className="px-4 py-3 text-gray-600">{c.employees}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at.slice(0, 10))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
