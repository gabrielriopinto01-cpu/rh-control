'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Briefcase, Users, CheckCircle2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

const STEPS = [
  { id: 1, label: 'Empresa',       icon: Building2, desc: 'Configure os dados básicos' },
  { id: 2, label: 'Departamentos', icon: Building2, desc: 'Crie a estrutura da empresa' },
  { id: 3, label: 'Cargos',        icon: Briefcase, desc: 'Defina os cargos disponíveis' },
  { id: 4, label: 'Pronto!',       icon: CheckCircle2, desc: 'Tudo configurado' },
]

type Dept   = { name: string }
type Cargo  = { title: string; dept: string }

export default function OnboardingPage() {
  const { user }    = useAuth()
  const router      = useRouter()
  const [step,      setStep]      = useState(1)
  const [saving,    setSaving]    = useState(false)

  // Step 1 — empresa
  const [cnpj,      setCnpj]      = useState('')

  // Step 2 — departamentos
  const [depts,     setDepts]     = useState<Dept[]>([
    { name: 'Recursos Humanos' }, { name: 'Financeiro' }, { name: 'Tecnologia' },
  ])
  const [newDept,   setNewDept]   = useState('')

  // Step 3 — cargos
  const [cargos,    setCargos]    = useState<Cargo[]>([])
  const [newCargo,  setNewCargo]  = useState({ title: '', dept: '' })

  const addDept = () => {
    if (!newDept.trim()) return
    setDepts(d => [...d, { name: newDept.trim() }])
    setNewDept('')
  }

  const addCargo = () => {
    if (!newCargo.title.trim()) return
    setCargos(c => [...c, { ...newCargo }])
    setNewCargo({ title: '', dept: '' })
  }

  const handleFinish = async () => {
    if (!isSupabaseConfigured() || !user) return
    setSaving(true)
    const supabase = createClient()

    // Salva CNPJ
    if (cnpj) {
      await supabase.from('companies').update({ cnpj }).eq('id', user.company_id)
    }

    // Cria departamentos
    if (depts.length > 0) {
      await supabase.from('departments').insert(
        depts.map(d => ({ company_id: user.company_id, name: d.name }))
      )
    }

    // Busca IDs dos departamentos criados para vincular aos cargos
    const { data: deptRows } = await supabase
      .from('departments').select('id, name').eq('company_id', user.company_id)

    // Cria cargos
    if (cargos.length > 0) {
      await supabase.from('positions').insert(
        cargos.map(c => ({
          company_id:    user.company_id,
          title:         c.title,
          department_id: deptRows?.find(d => d.name === c.dept)?.id ?? null,
        }))
      )
    }

    setSaving(false)
    toast.success('Empresa configurada com sucesso!')
    router.push('/dashboard')
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-blue-600 items-center justify-center mb-3">
            <span className="text-white font-black text-xl">RH</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Bem-vindo ao RH Control</h1>
          <p className="text-slate-400 mt-1">Configure sua empresa em 3 minutos</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0 transition-all ${
                step > s.id  ? 'bg-green-500 text-white' :
                step === s.id ? 'bg-blue-600 text-white' :
                'bg-slate-700 text-slate-400'
              }`}>
                {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className={`text-sm hidden sm:block ${step === s.id ? 'text-white font-medium' : 'text-slate-500'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 ${step > s.id ? 'bg-green-500' : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* Step 1 — Empresa */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Dados da empresa</h2>
                <p className="text-gray-500 text-sm mt-1">Informe o CNPJ para emissão de documentos legais</p>
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ <span className="text-gray-400">(opcional)</span></Label>
                <Input
                  placeholder="00.000.000/0001-00"
                  value={cnpj}
                  onChange={e => setCnpj(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400 bg-blue-50 rounded-lg p-3">
                💡 Você pode preencher depois em Configurações → Dados da empresa.
              </p>
            </div>
          )}

          {/* Step 2 — Departamentos */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Departamentos</h2>
                <p className="text-gray-500 text-sm mt-1">Organize a estrutura da sua empresa</p>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {depts.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-blue-800">{d.name}</span>
                    <button onClick={() => setDepts(ds => ds.filter((_, j) => j !== i))}
                      className="text-blue-400 hover:text-red-500 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do departamento"
                  value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDept() }}}
                />
                <Button type="button" variant="outline" onClick={addDept}>Adicionar</Button>
              </div>
              <p className="text-xs text-gray-400">Pressione Enter ou clique em Adicionar para incluir</p>
            </div>
          )}

          {/* Step 3 — Cargos */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Cargos</h2>
                <p className="text-gray-500 text-sm mt-1">Defina os cargos da empresa <span className="text-gray-400">(opcional)</span></p>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {cargos.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{c.title}</span>
                      {c.dept && <span className="text-xs text-gray-400 ml-2">— {c.dept}</span>}
                    </div>
                    <button onClick={() => setCargos(cs => cs.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                  </div>
                ))}
                {cargos.length === 0 && (
                  <p className="text-sm text-gray-400 py-2 text-center">Nenhum cargo adicionado ainda</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Título do cargo (ex: Analista de RH)"
                  value={newCargo.title}
                  onChange={e => setNewCargo(f => ({ ...f, title: e.target.value }))}
                  className="flex-1"
                />
                <select
                  value={newCargo.dept}
                  onChange={e => setNewCargo(f => ({ ...f, dept: e.target.value }))}
                  className="border rounded-md px-2 text-sm text-gray-700 bg-white"
                >
                  <option value="">Dept.</option>
                  {depts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                <Button type="button" variant="outline" onClick={addCargo}>Adicionar</Button>
              </div>
            </div>
          )}

          {/* Step 4 — Concluir */}
          {step === 4 && (
            <div className="text-center space-y-5 py-4">
              <div className="inline-flex h-20 w-20 rounded-full bg-green-100 items-center justify-center mx-auto">
                <Sparkles className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Tudo pronto!</h2>
                <p className="text-gray-500 mt-2">
                  Sua empresa está configurada com{' '}
                  <strong>{depts.length} departamento{depts.length !== 1 ? 's' : ''}</strong>
                  {cargos.length > 0 && <> e <strong>{cargos.length} cargo{cargos.length !== 1 ? 's' : ''}</strong></>}.
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 text-left space-y-1.5">
                <p>✅ Agora você pode:</p>
                <p>• Cadastrar colaboradores em <strong>Colaboradores → Novo</strong></p>
                <p>• Convidar usuários em <strong>Configurações → Convidar membro</strong></p>
                <p>• Gerar a folha de pagamento em <strong>Folha de Pagamento</strong></p>
              </div>
            </div>
          )}

          {/* Navegação */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 1 && step < 4 ? (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            ) : <div />}

            {step < 3 && (
              <Button onClick={() => setStep(s => s + 1)}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={() => setStep(4)}>
                Concluir configuração <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={handleFinish} disabled={saving} className="w-full">
                {saving && <span className="mr-2 animate-spin">⟳</span>}
                Ir para o dashboard
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-4">
          Quer pular?{' '}
          <button onClick={() => router.push('/dashboard')} className="text-blue-400 hover:text-blue-300 underline">
            Ir direto para o dashboard
          </button>
        </p>
      </div>
    </div>
  )
}
