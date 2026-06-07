'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Zap, Building2, Globe, ArrowRight, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/stripe/config'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

export default function PricingPage() {
  const { user }   = useAuth()
  const router     = useRouter()
  const [loading,  setLoading]  = useState<string | null>(null)

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const handleSubscribe = async (planId: string) => {
    if (!user) { router.push('/register'); return }

    setLoading(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planId }),
      })
      const { url, error } = await res.json()
      if (error) { toast.error(error); return }
      window.location.href = url
    } catch {
      toast.error('Erro ao iniciar checkout')
    } finally {
      setLoading(null)
    }
  }

  const planList = Object.values(PLANS)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="text-center pt-20 pb-12 px-4">
        <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-full px-4 py-1.5 mb-6">
          <Zap className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-blue-300 text-sm font-medium">Planos e Preços</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
          O RH certo para<br />cada tamanho de empresa
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Comece grátis por 14 dias. Sem cartão de crédito.
          Cancele quando quiser.
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-6xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {planList.map(plan => (
            <div key={plan.id}
              className={`relative rounded-2xl border p-8 transition-all ${
                plan.highlight
                  ? 'bg-white border-white shadow-2xl shadow-blue-500/30 scale-105'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full px-4 py-1.5 shadow-lg">
                    <Star className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
                    <span className="text-white text-xs font-bold">Mais popular</span>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h2 className={`text-xl font-bold mb-1 ${plan.highlight ? 'text-gray-900' : 'text-white'}`}>
                  {plan.name}
                </h2>
                <p className={`text-sm ${plan.highlight ? 'text-gray-500' : 'text-slate-400'}`}>
                  {plan.description}
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-end gap-1">
                  <span className={`text-4xl font-black ${plan.highlight ? 'text-gray-900' : 'text-white'}`}>
                    {fmt(plan.price)}
                  </span>
                  <span className={`text-sm mb-1 ${plan.highlight ? 'text-gray-400' : 'text-slate-500'}`}>/mês</span>
                </div>
                <p className={`text-xs mt-1 ${plan.highlight ? 'text-gray-400' : 'text-slate-500'}`}>
                  Cobrado mensalmente · Cancele quando quiser
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.highlight ? 'text-blue-600' : 'text-green-400'}`} />
                    <span className={`text-sm ${plan.highlight ? 'text-gray-700' : 'text-slate-300'}`}>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading === plan.id}
                className={`w-full font-semibold ${
                  plan.highlight
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                }`}
              >
                {loading === plan.id ? (
                  <span className="animate-spin mr-2">⟳</span>
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                {user ? 'Assinar agora' : 'Começar grátis'}
              </Button>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-16 text-center space-y-6">
          <div className="flex flex-wrap justify-center gap-8 text-slate-400 text-sm">
            {[
              { icon: '🔒', text: 'Pagamento 100% seguro via Stripe' },
              { icon: '↩️', text: 'Garantia de 30 dias ou devolução' },
              { icon: '🇧🇷', text: 'Dados em servidores no Brasil' },
              { icon: '⚡', text: 'Suporte em português' },
            ].map(b => (
              <div key={b.text} className="flex items-center gap-2">
                <span>{b.icon}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>

          <p className="text-slate-500 text-sm">
            Tem dúvidas?{' '}
            <a href="mailto:contato@rhcontrol.com.br" className="text-blue-400 hover:text-blue-300 underline">
              contato@rhcontrol.com.br
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
