'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Users, Briefcase, CheckCircle2, ArrowRight, ArrowLeft,
  Upload, Loader2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

const STEPS = [
  { id: 1, title: 'Sua empresa',     icon: Building2, desc: 'Informações básicas da organização' },
  { id: 2, title: 'Departamento',    icon: Building2, desc: 'Crie o primeiro departamento'       },
  { id: 3, title: 'Cargo',           icon: Briefcase, desc: 'Adicione o primeiro cargo'          },
  { id: 4, title: 'Tudo pronto! 🎉', icon: CheckCircle2, desc: 'Seu RH está configurado'        },
]

interface Props {
  onClose: () => void
}

export function OnboardingWizard({ onClose }: Props) {
  const { user } = useAuth()
  const router   = useRouter()
  const [step, setStep]       = useState(1)
  const [saving, setSaving]   = useState(false)

  // Passo 1 — Empresa
  const [companyName, setCompanyName] = useState('')
  const [cnpj,        setCnpj]        = useState('')

  // Passo 2 — Departamento
  const [deptName, setDeptName] = useState('')

  // Passo 3 — Cargo
  const [posTitle,  setPosTitle]  = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')

  const supabase = createClient()

  const saveStep1 = async () => {
    if (!companyName.trim()) { toast.error('Nome da empresa é obrigatório'); return }
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('companies')
      .update({ name: companyName.trim(), cnpj: cnpj.trim() || null })
      .eq('id', user.company_id)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar empresa'); return }
    setStep(2)
  }

  const saveStep2 = async () => {
    if (!deptName.trim()) { toast.error('Nome do departamento é obrigatório'); return }
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('departments')
      .insert({ company_id: user.company_id, name: deptName.trim() })
    setSaving(false)
    if (error && !error.message.includes('duplicate')) { toast.error('Erro ao salvar departamento'); return }
    setStep(3)
  }

  const saveStep3 = async () => {
    if (!posTitle.trim()) { toast.error('Nome do cargo é obrigatório'); return }
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('positions')
      .insert({
        company_id: user.company_id,
        title:      posTitle.trim(),
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
      })
    setSaving(false)
    if (error) { toast.error('Erro ao salvar cargo'); return }
    setStep(4)
  }

  const finish = () => {
    localStorage.setItem('rh_onboarding_done', '1')
    onClose()
    router.push('/employees')
  }

  const skip = () => {
    localStorage.setItem('rh_onboarding_done', '1')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step > s.id  ? 'bg-indigo-600 text-white' :
                  step === s.id ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-600' :
                                  'bg-gray-100 text-gray-400'
                }`}>
                  {step > s.id ? '✓' : s.id}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 transition-colors ${step > s.id ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <button onClick={skip} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">

          {/* Step 1 — Empresa */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Vamos configurar sua empresa</h2>
                <p className="text-sm text-gray-500 mt-1">Essas informações aparecem nos documentos e relatórios.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Nome da empresa *</Label>
                  <Input
                    autoFocus
                    className="mt-1"
                    placeholder="Ex: Clínica Saúde Total LTDA"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveStep1()}
                  />
                </div>
                <div>
                  <Label>CNPJ <span className="text-gray-400 font-normal">(opcional)</span></Label>
                  <Input
                    className="mt-1"
                    placeholder="00.000.000/0001-00"
                    value={cnpj}
                    onChange={e => setCnpj(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Departamento */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Primeiro departamento</h2>
                <p className="text-sm text-gray-500 mt-1">Você pode criar mais depois em Pessoas → Departamentos.</p>
              </div>
              <div>
                <Label>Nome do departamento *</Label>
                <Input
                  autoFocus
                  className="mt-1"
                  placeholder="Ex: Administrativo, TI, Comercial..."
                  value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveStep2()}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {['Administrativo', 'Recursos Humanos', 'Financeiro', 'TI', 'Operacional', 'Comercial'].map(s => (
                  <button
                    key={s}
                    onClick={() => setDeptName(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Cargo */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Primeiro cargo</h2>
                <p className="text-sm text-gray-500 mt-1">Cargos são usados na folha, contratos e relatórios.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Nome do cargo *</Label>
                  <Input
                    autoFocus
                    className="mt-1"
                    placeholder="Ex: Assistente Administrativo, Analista de RH..."
                    value={posTitle}
                    onChange={e => setPosTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Salário mínimo <span className="text-gray-400 font-normal">(R$)</span></Label>
                    <Input
                      className="mt-1"
                      type="number"
                      placeholder="1.518,00"
                      value={salaryMin}
                      onChange={e => setSalaryMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Salário máximo <span className="text-gray-400 font-normal">(R$)</span></Label>
                    <Input
                      className="mt-1"
                      type="number"
                      placeholder="3.000,00"
                      value={salaryMax}
                      onChange={e => setSalaryMax(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Concluído */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Configuração concluída!</h2>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  Sua empresa está pronta no RH Control. O próximo passo é cadastrar seus colaboradores.
                </p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Próximos passos sugeridos</p>
                {[
                  'Cadastrar colaboradores → Pessoas → Colaboradores',
                  'Configurar horário de trabalho → Configurações',
                  'Ativar automações WhatsApp → Configurações → Automações',
                  'Explorar o Assistente IA → menu lateral',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-indigo-800">
                    <span className="shrink-0 font-bold">{i + 1}.</span> {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <div>
            {step > 1 && step < 4 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} disabled={saving}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
            {step < 4 && (
              <Button variant="ghost" size="sm" className="text-gray-400 ml-1" onClick={skip}>
                Pular configuração
              </Button>
            )}
          </div>

          {step === 1 && (
            <Button onClick={saveStep1} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={saveStep2} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={saveStep3} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Concluir <CheckCircle2 className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 4 && (
            <Button onClick={finish} className="bg-indigo-600 hover:bg-indigo-700">
              Ir para colaboradores <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
