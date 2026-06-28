'use client'

import { useState, useCallback, useRef } from 'react'
import { ScrollText, Search, Printer, Download, Loader2, User, Building2, Calendar, DollarSign, MapPin, Phone, Mail, Hash, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useBrandingStore } from '@/lib/store/branding-store'

export const dynamic = 'force-dynamic'

type Employee = {
  id: string
  full_name: string
  cpf: string | null
  rg: string | null
  address: string | null
  address_city: string | null
  address_state: string | null
  phone: string | null
  email: string | null
  hire_date: string | null
  salary: number | null
  position: string | null
  contract_type: string | null
  work_schedule: string | null
  department: { name: string } | null
  nationality: string | null
  marital_status: string | null
}

type Company = {
  name: string
  cnpj: string | null
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  email: string | null
  legal_representative: string | null
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  clt:       'CLT (Consolidação das Leis do Trabalho)',
  pj:        'Pessoa Jurídica (PJ)',
  temporary: 'Contrato Temporário',
  internship:'Estágio',
  apprentice:'Aprendiz',
}

const MARITAL_LABELS: Record<string, string> = {
  single:   'Solteiro(a)',
  married:  'Casado(a)',
  divorced: 'Divorciado(a)',
  widowed:  'Viúvo(a)',
  other:    'Outro',
}

function fmtDate(iso: string | null) {
  if (!iso) return '___/___/______'
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtCurrency(v: number | null) {
  if (!v) return 'R$ ____________'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtCity(city: string | null, state: string | null) {
  if (!city && !state) return '____________'
  return [city, state].filter(Boolean).join(' - ')
}

export default function ContratoAdmissaoPage() {
  const { user }    = useAuth()
  const { branding } = useBrandingStore()
  const [search, setSearch]   = useState('')
  const [options, setOptions] = useState<{ id: string; full_name: string; position: string | null }[]>([])
  const [searching, setSearching] = useState(false)
  const [employee, setEmployee]   = useState<Employee | null>(null)
  const [company,  setCompany]    = useState<Company | null>(null)
  const [loading,  setLoading]    = useState(false)
  const [showOpts, setShowOpts]   = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const searchEmployees = useCallback(async (q: string) => {
    if (!isSupabaseConfigured() || !user?.company_id || q.length < 2) {
      setOptions([]); setShowOpts(false); return
    }
    setSearching(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, position')
      .eq('company_id', user.company_id)
      .eq('status', 'active')
      .ilike('full_name', `%${q}%`)
      .limit(8)
    setOptions(data ?? [])
    setShowOpts(true)
    setSearching(false)
  }, [user])

  const selectEmployee = useCallback(async (id: string) => {
    setShowOpts(false)
    if (!isSupabaseConfigured() || !user?.company_id) return
    setLoading(true)
    const supabase = createClient()
    const [empRes, compRes] = await Promise.all([
      supabase.from('employees').select(
        'id, full_name, cpf, rg, address, address_city, address_state, phone, email, hire_date, salary, position, contract_type, work_schedule, nationality, marital_status, department:departments(name)'
      ).eq('id', id).single(),
      supabase.from('companies').select(
        'name, cnpj, address, city, state, phone, email, legal_representative'
      ).eq('id', user.company_id).single(),
    ])
    if (empRes.data) setEmployee(empRes.data as unknown as Employee)
    if (compRes.data) setCompany(compRes.data as Company)
    setLoading(false)
  }, [user])

  function handlePrint() {
    if (!printRef.current) return
    const win = window.open('', '_blank', 'width=900,height=800')
    if (!win) { toast.error('Permita popups para imprimir'); return }
    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8"/>
        <title>Contrato de Admissão — ${employee?.full_name ?? ''}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; padding: 2.5cm 3cm; }
          h1 { text-align: center; font-size: 16pt; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
          h2 { text-align: center; font-size: 12pt; font-weight: normal; margin-bottom: 32px; }
          h3 { font-size: 12pt; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; margin: 24px 0 12px; }
          p { line-height: 1.8; text-align: justify; margin-bottom: 10px; }
          .section { margin-bottom: 20px; }
          .sig-area { display: flex; gap: 80px; margin-top: 60px; }
          .sig-line { flex: 1; text-align: center; }
          .sig-line hr { border: none; border-top: 1px solid #000; margin-bottom: 6px; }
          .sig-line p { font-size: 10pt; }
          .date-line { margin-top: 40px; text-align: right; }
          .witness-area { display: flex; gap: 80px; margin-top: 48px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${printRef.current.innerHTML}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  const emp = employee
  const co  = company

  const contractTypeLabel = CONTRACT_TYPE_LABELS[emp?.contract_type ?? 'clt'] ?? 'CLT'
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const cityDate = `${co?.city ?? branding.system_name ?? '___________'}, ${today}`

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6" /> Contrato de Admissão
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gere e imprima contratos de admissão para colaboradores</p>
      </div>

      {/* Seleção de colaborador */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <User className="h-4 w-4" /> Selecionar Colaborador
        </h2>
        <div className="relative max-w-md">
          <Label className="mb-1.5 block">Nome do colaborador</Label>
          <div className="relative">
            <Input
              placeholder="Digite o nome para pesquisar..."
              value={search}
              onChange={e => { setSearch(e.target.value); searchEmployees(e.target.value) }}
              onFocus={() => { if (options.length) setShowOpts(true) }}
              className="pr-8"
            />
            {searching
              ? <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
              : <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            }
          </div>
          {showOpts && options.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
              {options.map(o => (
                <button
                  key={o.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm"
                  onClick={() => { setSearch(o.full_name); selectEmployee(o.id) }}
                >
                  <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="font-medium">{o.full_name}</span>
                  {o.position && <span className="text-gray-400 text-xs ml-auto">{o.position}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {employee && !loading && (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg text-sm">
            <User className="h-4 w-4 text-green-600 shrink-0" />
            <span className="font-medium text-green-800">{employee.full_name}</span>
            {employee.position && <span className="text-green-600">— {employee.position}</span>}
            <Button size="sm" className="ml-auto gap-1.5" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados...
          </div>
        )}
      </div>

      {/* Preview do contrato */}
      {emp && co && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b bg-gray-50">
            <span className="text-sm font-medium text-gray-600">Prévia do contrato</span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Imprimir / Salvar PDF
            </Button>
          </div>

          {/* ── Corpo do contrato (referência para impressão) ── */}
          <div
            ref={printRef}
            className="p-10 font-serif text-[13px] leading-relaxed text-gray-900 space-y-5 max-w-3xl mx-auto"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {/* Cabeçalho */}
            <div className="text-center space-y-1 mb-8">
              <h1 className="text-xl font-bold uppercase tracking-widest">{co.name}</h1>
              {co.cnpj && <p className="text-sm">CNPJ: {co.cnpj}</p>}
              {(co.address || co.city) && (
                <p className="text-sm">
                  {[co.address, co.city, co.state].filter(Boolean).join(', ')}
                </p>
              )}
              <div className="mt-4 border-y-2 border-gray-900 py-2">
                <h2 className="text-base font-bold uppercase tracking-widest">Contrato de Trabalho</h2>
                <p className="text-sm">{contractTypeLabel}</p>
              </div>
            </div>

            {/* Qualificação das partes */}
            <section>
              <h3 className="font-bold uppercase text-xs tracking-wider border-b border-gray-400 pb-1 mb-3">1. Das Partes</h3>
              <p>
                <strong>EMPREGADOR:</strong> {co.name},
                {co.cnpj ? ` inscrita no CNPJ sob o nº ${co.cnpj}, ` : ' '}
                com sede em {[co.address, co.city, co.state].filter(Boolean).join(', ') || '____________'},
                {co.legal_representative
                  ? `, neste ato representada por ${co.legal_representative},`
                  : ''} doravante denominada simplesmente <strong>CONTRATANTE</strong>.
              </p>
              <p className="mt-3">
                <strong>EMPREGADO(A):</strong> {emp.full_name},
                {emp.nationality ? ` ${emp.nationality},` : ''}
                {emp.marital_status ? ` ${MARITAL_LABELS[emp.marital_status] ?? emp.marital_status},` : ''}
                {emp.cpf ? ` portador(a) do CPF nº ${emp.cpf},` : ''}
                {emp.rg  ? ` RG nº ${emp.rg},` : ''}
                residente e domiciliado(a) em {[emp.address, emp.address_city, emp.address_state].filter(Boolean).join(', ') || '____________'},
                {emp.email ? ` e-mail: ${emp.email},` : ''}
                {emp.phone ? ` telefone: ${emp.phone},` : ''}
                doravante denominado(a) simplesmente <strong>CONTRATADO(A)</strong>.
              </p>
            </section>

            {/* Cláusula 1 — Objeto */}
            <section>
              <h3 className="font-bold uppercase text-xs tracking-wider border-b border-gray-400 pb-1 mb-3">2. Do Objeto e da Função</h3>
              <p>
                O(A) CONTRATADO(A) é admitido(a) para exercer as funções inerentes ao cargo de{' '}
                <strong>{emp.position || '____________'}</strong>
                {emp.department ? `, lotado(a) no departamento de ${(emp.department as { name: string }).name}` : ''},
                devendo desempenhar todas as atribuições pertinentes ao cargo, bem como outras que lhe forem designadas pela CONTRATANTE.
              </p>
            </section>

            {/* Cláusula 2 — Início */}
            <section>
              <h3 className="font-bold uppercase text-xs tracking-wider border-b border-gray-400 pb-1 mb-3">3. Da Data de Início</h3>
              <p>
                O presente contrato terá início em <strong>{fmtDate(emp.hire_date)}</strong>,
                sendo o vínculo empregatício regido pelas normas da {contractTypeLabel}.
              </p>
            </section>

            {/* Cláusula 3 — Remuneração */}
            <section>
              <h3 className="font-bold uppercase text-xs tracking-wider border-b border-gray-400 pb-1 mb-3">4. Da Remuneração</h3>
              <p>
                A CONTRATANTE pagará ao(à) CONTRATADO(A), a título de salário, a importância de{' '}
                <strong>{fmtCurrency(emp.salary)}</strong> mensais, a ser pago até o 5º (quinto) dia útil do mês subsequente
                ao trabalhado, mediante depósito em conta bancária ou outra forma acordada entre as partes.
              </p>
              <p>
                Sobre o salário incidirão os descontos legais previstos em lei, incluindo INSS e IRRF,
                quando aplicáveis, além de outros acordados em Convenção ou Acordo Coletivo de Trabalho.
              </p>
            </section>

            {/* Cláusula 4 — Jornada */}
            <section>
              <h3 className="font-bold uppercase text-xs tracking-wider border-b border-gray-400 pb-1 mb-3">5. Da Jornada de Trabalho</h3>
              <p>
                A jornada de trabalho será de <strong>{emp.work_schedule || '44 (quarenta e quatro) horas semanais'}</strong>,
                distribuídas de acordo com as necessidades da CONTRATANTE, respeitando os limites
                legais estabelecidos na Consolidação das Leis do Trabalho e legislação complementar.
              </p>
              <p>
                O(A) CONTRATADO(A) terá direito ao intervalo para refeição e descanso conforme previsto
                no art. 71 da CLT, bem como ao repouso semanal remunerado.
              </p>
            </section>

            {/* Cláusula 5 — Obrigações */}
            <section>
              <h3 className="font-bold uppercase text-xs tracking-wider border-b border-gray-400 pb-1 mb-3">6. Das Obrigações das Partes</h3>
              <p>
                <strong>6.1.</strong> O(A) CONTRATADO(A) compromete-se a: (i) zelar pelo patrimônio
                e pela imagem da CONTRATANTE; (ii) guardar sigilo sobre as informações confidenciais
                a que tiver acesso; (iii) cumprir as normas internas, regulamentos e políticas da empresa;
                (iv) apresentar-se de forma adequada ao ambiente de trabalho; e (v) tratar com respeito
                todos os colegas, clientes e fornecedores.
              </p>
              <p>
                <strong>6.2.</strong> A CONTRATANTE compromete-se a: (i) fornecer as condições
                necessárias para o desempenho das funções; (ii) efetuar o pagamento da remuneração
                nas datas acordadas; (iii) respeitar os direitos trabalhistas e previdenciários previstos
                em lei; e (iv) zelar por um ambiente de trabalho seguro e saudável.
              </p>
            </section>

            {/* Cláusula 6 — Benefícios */}
            <section>
              <h3 className="font-bold uppercase text-xs tracking-wider border-b border-gray-400 pb-1 mb-3">7. Dos Benefícios</h3>
              <p>
                O(A) CONTRATADO(A) terá direito aos benefícios concedidos pela CONTRATANTE conforme
                política interna vigente, podendo incluir vale-transporte, vale-alimentação/refeição,
                plano de saúde e demais benefícios previstos em Acordo ou Convenção Coletiva, quando aplicáveis.
              </p>
            </section>

            {/* Cláusula 7 — Rescisão */}
            <section>
              <h3 className="font-bold uppercase text-xs tracking-wider border-b border-gray-400 pb-1 mb-3">8. Da Rescisão</h3>
              <p>
                O presente contrato poderá ser rescindido por qualquer das partes, observados os prazos
                de aviso prévio e demais disposições legais previstas na CLT e legislação vigente.
                Nos casos de justa causa, a rescisão ocorrerá sem direito ao aviso prévio, conforme
                previsão legal.
              </p>
            </section>

            {/* Cláusula 8 — Foro */}
            <section>
              <h3 className="font-bold uppercase text-xs tracking-wider border-b border-gray-400 pb-1 mb-3">9. Das Disposições Gerais e Foro</h3>
              <p>
                O presente instrumento é regido pelas disposições da CLT e legislação trabalhista vigente.
                Para dirimir quaisquer dúvidas ou controvérsias decorrentes deste contrato, fica eleito
                o foro da Comarca de{' '}
                <strong>{co.city || '____________'}</strong>, com renúncia expressa a qualquer outro,
                por mais privilegiado que seja.
              </p>
              <p>
                E por estarem assim justos e contratados, as partes firmam o presente instrumento em
                2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.
              </p>
            </section>

            {/* Local e data */}
            <p className="text-right mt-8">{cityDate}</p>

            {/* Assinaturas */}
            <div className="grid grid-cols-2 gap-16 mt-10">
              <div className="text-center">
                <div className="border-t border-gray-900 pt-2 mt-10">
                  <p className="font-bold">{co.name}</p>
                  {co.legal_representative && <p className="text-xs">{co.legal_representative}</p>}
                  <p className="text-xs text-gray-500">CONTRATANTE</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-900 pt-2 mt-10">
                  <p className="font-bold">{emp.full_name}</p>
                  {emp.cpf && <p className="text-xs">CPF: {emp.cpf}</p>}
                  <p className="text-xs text-gray-500">CONTRATADO(A)</p>
                </div>
              </div>
            </div>

            {/* Testemunhas */}
            <div className="mt-8">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-6">Testemunhas:</p>
              <div className="grid grid-cols-2 gap-16">
                {[1, 2].map(n => (
                  <div key={n} className="text-center">
                    <div className="border-t border-gray-900 pt-2 mt-10">
                      <p className="text-xs">Nome: ________________________________</p>
                      <p className="text-xs mt-1">CPF: _____________________________</p>
                      <p className="text-xs text-gray-400 mt-1">Testemunha {n}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé */}
            <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
              Desenvolvido por GRP Tecnologia
            </div>
          </div>
        </div>
      )}

      {!emp && !loading && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum colaborador selecionado</p>
          <p className="text-sm mt-1">Pesquise um colaborador acima para gerar o contrato</p>
        </div>
      )}
    </div>
  )
}
