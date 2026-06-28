'use client'

import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

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

function brl(n?: number | null) {
  if (n == null) return null
  return `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export default function MeusBeneficiosPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured() || !user?.employee_id) { setLoading(false); return }
    createClient()
      .from('employee_benefits')
      .select('*, benefit:benefits(*)')
      .eq('employee_id', user.employee_id)
      .is('end_date', null)
      .order('start_date', { ascending: false })
      .then(({ data }) => { setItems(data ?? []); setLoading(false) })
  }, [user])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Gift className="h-6 w-6" /> Meus Benefícios</h1>
        <p className="text-muted-foreground text-sm mt-1">Benefícios ativos vinculados ao seu cadastro</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground">
          <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum benefício vinculado ainda</p>
          <p className="text-xs mt-1">Fale com o RH para incluir seus benefícios</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item: any) => {
            const b  = item.benefit
            const tc = TYPE_LABELS[b?.type] ?? TYPE_LABELS.other!
            return (
              <div key={item.id} className="bg-card border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{b?.name}</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${tc.color}`}>{tc.label}</span>
                  </div>
                </div>
                {b?.description && <p className="text-sm text-muted-foreground">{b.description}</p>}
                <div className="flex gap-4 text-sm pt-1">
                  {b?.employee_discount != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Desconto mensal</p>
                      <p className="font-medium text-orange-600">{brl(b.employee_discount)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Desde</p>
                    <p className="font-medium">{new Date(item.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
