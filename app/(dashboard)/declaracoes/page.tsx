'use client'

import { useState, useCallback, useRef } from 'react'
import { FileCheck, Search, Loader2, Printer, User, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  position: string | null
  hire_date: string | null
  salary: number | null
  nationality: string | null
  marital_status: string | null
  address: string | null
  address_city: string | null
  address_state: string | null
  department: { name: string } | null
}

type Company = {
  name: string
  cnpj: string | null
  address: string | null
  city: string | null
  state: string | null
  legal_representative: string | null
}

type DocType =
  | 'vinculo'
  | 'renda'
  | 'referencia'
  | 'ferias'
  | 'rescisao_aviso'
  | 'personalizada'

const DOC_TYPES: { value: DocType; label: string; desc: string }[] = [
  { value: 'vinculo',       label: 'Declaração de Vínculo Empregatício', desc: 'Confirma que o colaborador é funcionário da empresa' },
  { value: 'renda',         label: 'Declaração de Renda',                desc: 'Informa o salário mensal para fins cadastrais' },
  { value: 'referencia',    label: 'Carta de Referência',                desc: 'Recomendação formal do colaborador' },
  { value: 'ferias',        label: 'Declaração de Férias',               desc: 'Confirma o período de férias do colaborador' },
  { value: 'rescisao_aviso',label: 'Aviso Prévio',                       desc: 'Comunicado formal de aviso prévio' },
  { value: 'personalizada', label: 'Declaração Personalizada',           desc: 'Texto livre com cabeçalho e assinatura da empresa' },
]

const MARITAL: Record<string, string> = {
  single: 'solteiro(a)', married: 'casado(a)', divorced: 'divorciado(a)', widowed: 'viúvo(a)', other: 'outro',
}

function fmtCurrency(v: number | null) {
  if (!v) return 'R$ ____________'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string | null) {
  if (!iso) return '___/___/______'
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function yearsOf(iso: string | null) {
  if (!iso) return 0
  return new Date().getFullYear() - new Date(iso).getFullYear()
}

export default function DeclaracoesPage() {
  const { user }     = useAuth()
  const { branding } = useBrandingStore()

  const [search,    setSearch]    = useState('')
  const [options,   setOptions]   = useState<{ id: string; full_name: string; position: string | null }[]>([])
  const [showOpts,  setShowOpts]  = useState(false)
  const [searching, setSearching] = useState(false)
  const [loading,   setLoading]   = useState(false)

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [company,  setCompany]  = useState<Company | null>(null)
  const [docType,  setDocType]  = useState<DocType>('vinculo')

  // Campos extras para declaração personalizada e férias / aviso
  const [customText,  setCustomText]  = useState('')
  const [feriasInicio,setFeriasInicio]= useState('')
  const [feriasFim,   setFeriasFim]   = useState('')
  const [avisoDias,   setAvisoDias]   = useState('30')
  const [avisoMotivo, setAvisoMotivo] = useState<'sem_justa' | 'pedido'>('sem_justa')
  const [finalidade,  setFinalidade]  = useState('')   // para "a quem interessar possa"

  const printRef = useRef<HTMLDivElement>(null)

  const searchEmployees = useCallback(async (q: string) => {
    if (!isSupabaseConfigured() || !user?.company_id || q.length < 2) {
      setOptions([]); setShowOpts(false); return
    }
    setSearching(true)
    const supabase = createClient()
    const { data } = await supabase.from('employees')
      .select('id, full_name, position').eq('company_id', user.company_id)
      .ilike('full_name', `%${q}%`).limit(8)
    setOptions(data ?? [])
    setShowOpts(true)
    setSearching(false)
  }, [user])

  const selectEmployee = useCallback(async (id: string, name: string) => {
    setShowOpts(false); setSearch(name)
    if (!isSupabaseConfigured() || !user?.company_id) return
    setLoading(true)
    const supabase = createClient()
    const [empRes, coRes] = await Promise.all([
      supabase.from('employees').select(
        'id, full_name, cpf, rg, position, hire_date, salary, nationality, marital_status, address, address_city, address_state, department:departments(name)'
      ).eq('id', id).single(),
      supabase.from('companies').select('name, cnpj, address, city, state, legal_representative')
        .eq('id', user.company_id).single(),
    ])
    if (empRes.data) setEmployee(empRes.data as unknown as Employee)
    if (coRes.data)  setCompany(coRes.data as Company)
    setLoading(false)
  }, [user])

  function handlePrint() {
    if (!printRef.current) return
    const win = window.open('', '_blank', 'width=860,height=750')
    if (!win) { toast.error('Permita popups para imprimir'); return }
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
      <title>${DOC_TYPES.find(d => d.value === docType)?.label ?? 'Declaração'}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000;padding:3cm 3.5cm}
        h1{font-size:14pt;text-align:center;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
        .subtitle{text-align:center;font-size:10pt;color:#444;margin-bottom:32px}
        p{line-height:1.9;text-align:justify;margin-bottom:12px}
        .date{text-align:right;margin:40px 0 16px}
        .sig{text-align:center;margin-top:56px}
        .sig hr{border:none;border-top:1px solid #000;width:280px;margin:0 auto 8px}
        .sig p{font-size:10pt}
        .footer{text-align:center;margin-top:48px;font-size:9pt;color:#888;border-top:1px solid #ddd;padding-top:8px}
        @media print{body{padding:0}}
      </style></head><body>${printRef.current.innerHTML}</body></html>`)
    win.document.close(); win.focus()
    setTimeout(() => win.print(), 400)
  }

  const emp = employee; const co = company
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const cityDate = `${co?.city ?? branding.system_name ?? '___________'}, ${today}`
  const deptName = (emp?.department as { name: string } | null)?.name

  // ── Gera o corpo do documento conforme o tipo ──
  function buildBody(): string {
    if (!emp || !co) return ''
    const rep  = co.legal_representative ?? co.name
    const dest = finalidade ? `para fins de ${finalidade}` : 'para os fins que se fizer necessário'

    switch (docType) {
      case 'vinculo': return `
        <p>Declaramos, para ${dest}, que <strong>${emp.full_name}</strong>${emp.nationality ? `, ${emp.nationality},` : ''}${emp.marital_status ? ` ${MARITAL[emp.marital_status] ?? emp.marital_status},` : ''}${emp.cpf ? ` portador(a) do CPF nº ${emp.cpf}${emp.rg ? ` e RG nº ${emp.rg}` : ''}` : ''}, é colaborador(a) desta empresa desde <strong>${fmtDate(emp.hire_date)}</strong>, exercendo o cargo de <strong>${emp.position ?? '____________'}</strong>${deptName ? `, no departamento de ${deptName}` : ''}, sob regime de trabalho regido pela Consolidação das Leis do Trabalho (CLT).</p>
        <p>A declaração é expedida a pedido do(a) interessado(a), a quem reservamos o direito de verificar as informações acima junto ao nosso Departamento de Recursos Humanos.</p>
      `
      case 'renda': return `
        <p>Declaramos, para ${dest}, que <strong>${emp.full_name}</strong>${emp.cpf ? `, portador(a) do CPF nº ${emp.cpf}` : ''}, é colaborador(a) desta empresa desde ${fmtDate(emp.hire_date)}, exercendo o cargo de <strong>${emp.position ?? '____________'}</strong>, e percebe remuneração mensal bruta no valor de <strong>${fmtCurrency(emp.salary)}</strong> (${emp.salary ? numberToWords(emp.salary) : '____________'}).</p>
        <p>A presente declaração é fornecida a pedido do(a) interessado(a), ${dest}, não podendo ser utilizada para outros fins que não os declarados.</p>
      `
      case 'referencia': return `
        <p>Vimos por meio desta apresentar e recomendar <strong>${emp.full_name}</strong>, que atuou em nossa empresa desde <strong>${fmtDate(emp.hire_date)}</strong> no cargo de <strong>${emp.position ?? '____________'}</strong>${deptName ? `, no departamento de ${deptName}` : ''}${yearsOf(emp.hire_date) > 0 ? `, completando ${yearsOf(emp.hire_date)} ano(s) de dedicação à organização` : ''}.</p>
        <p>Durante o período em que esteve conosco, ${emp.full_name} demonstrou alto nível de comprometimento, responsabilidade e capacidade técnica para o exercício de suas funções. Seu relacionamento interpessoal foi sempre marcado pelo profissionalismo e pela ética, contribuindo positivamente para o ambiente de trabalho e para os resultados da equipe.</p>
        <p>Recomendamos sem reservas o(a) referido(a) profissional, acreditando que, onde quer que atue, haverá de corresponder à confiança que lhe for depositada.</p>
      `
      case 'ferias': {
        const ini = feriasInicio ? new Date(feriasInicio + 'T00:00:00').toLocaleDateString('pt-BR') : '___/___/______'
        const fim = feriasFim    ? new Date(feriasFim    + 'T00:00:00').toLocaleDateString('pt-BR') : '___/___/______'
        return `
          <p>Declaramos, para ${dest}, que <strong>${emp.full_name}</strong>${emp.cpf ? `, portador(a) do CPF nº ${emp.cpf}` : ''}, colaborador(a) desta empresa no cargo de <strong>${emp.position ?? '____________'}</strong>, gozará de férias regulamentares no período de <strong>${ini}</strong> a <strong>${fim}</strong>, em conformidade com o art. 129 da Consolidação das Leis do Trabalho.</p>
          <p>A declaração é expedida a pedido do(a) interessado(a), ${dest}.</p>
        `
      }
      case 'rescisao_aviso': {
        const tipo = avisoMotivo === 'sem_justa'
          ? 'dispensado(a) sem justa causa, nos termos dos artigos 487 e seguintes da CLT'
          : 'desligado(a) a pedido próprio, em conformidade com os artigos 487 e seguintes da CLT'
        return `
          <p>Comunicamos a <strong>${emp.full_name}</strong>${emp.cpf ? `, portador(a) do CPF nº ${emp.cpf}` : ''}, colaborador(a) desta empresa no cargo de <strong>${emp.position ?? '____________'}</strong>, que está sendo ${tipo}, cumprindo aviso prévio de <strong>${avisoDias} (${numberDays(+avisoDias)} dias)</strong> a contar desta data.</p>
          <p>O(a) colaborador(a) deverá cumprir o aviso prévio na modalidade <strong>trabalhado</strong>, devendo comparecer normalmente ao trabalho durante o período supracitado, salvo acordo em contrário entre as partes.</p>
          <p>Ao término do aviso prévio, serão providenciadas as verbas rescisórias devidas na forma da lei.</p>
        `
      }
      case 'personalizada': return `<p>${customText.replace(/\n/g, '</p><p>')}</p>`
      default: return ''
    }
  }

  function numberToWords(n: number): string {
    // Extenso simplificado para valores até 99.999
    const units  = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove']
    const tens   = ['','dez','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa']
    const huns   = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos']
    const reais  = Math.floor(n)
    const cents  = Math.round((n - reais) * 100)
    function conv(x: number): string {
      if (x === 0) return 'zero'
      if (x === 100) return 'cem'
      let s = ''
      if (x >= 1000) { s += conv(Math.floor(x/1000)) + ' mil'; x %= 1000; if (x) s += ' e ' }
      if (x >= 100)  { s += huns[Math.floor(x/100)]; x %= 100; if (x) s += ' e ' }
      if (x >= 20)   { s += tens[Math.floor(x/10)]; x %= 10; if (x) s += ' e ' }
      if (x > 0)     { s += units[x] }
      return s.trim()
    }
    let r = conv(reais) + (reais === 1 ? ' real' : ' reais')
    if (cents) r += ' e ' + conv(cents) + (cents === 1 ? ' centavo' : ' centavos')
    return r
  }

  function numberDays(n: number): string {
    const map: Record<number,string> = {7:'sete',14:'quatorze',15:'quinze',30:'trinta',45:'quarenta e cinco',60:'sessenta',90:'noventa'}
    return map[n] ?? String(n)
  }

  const body = buildBody()
  const docLabel = DOC_TYPES.find(d => d.value === docType)?.label ?? 'Declaração'

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileCheck className="h-6 w-6" /> Gerador de Declarações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Documentos formais gerados automaticamente com os dados do colaborador</p>
      </div>

      {/* Controles */}
      <div className="bg-white border rounded-xl p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Tipo de documento */}
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Tipo de documento</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {DOC_TYPES.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDocType(d.value)}
                  className={`text-left border rounded-lg px-3 py-2.5 transition-colors ${docType === d.value ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <p className={`text-sm font-medium ${docType === d.value ? 'text-blue-700' : 'text-gray-800'}`}>{d.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Busca colaborador */}
          <div className="relative">
            <Label className="mb-1.5 block">Colaborador</Label>
            <div className="relative">
              <Input
                placeholder="Pesquisar..."
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
                  <button key={o.id} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm"
                    onClick={() => selectEmployee(o.id, o.full_name)}>
                    <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="font-medium">{o.full_name}</span>
                    {o.position && <span className="text-gray-400 text-xs ml-auto">{o.position}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Finalidade */}
          <div>
            <Label className="mb-1.5 block">Finalidade (opcional)</Label>
            <Input
              placeholder="ex: comprovação de renda, matrícula escolar..."
              value={finalidade}
              onChange={e => setFinalidade(e.target.value)}
            />
          </div>

          {/* Campos específicos por tipo */}
          {docType === 'ferias' && (
            <>
              <div>
                <Label className="mb-1.5 block">Início das férias</Label>
                <input type="date" value={feriasInicio} onChange={e => setFeriasInicio(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
              </div>
              <div>
                <Label className="mb-1.5 block">Fim das férias</Label>
                <input type="date" value={feriasFim} onChange={e => setFeriasFim(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
              </div>
            </>
          )}

          {docType === 'rescisao_aviso' && (
            <>
              <div>
                <Label className="mb-1.5 block">Motivo do aviso</Label>
                <select value={avisoMotivo} onChange={e => setAvisoMotivo(e.target.value as any)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="sem_justa">Dispensa sem justa causa</option>
                  <option value="pedido">Pedido de demissão</option>
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block">Dias de aviso prévio</Label>
                <select value={avisoDias} onChange={e => setAvisoDias(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  {['7','14','15','30','45','60','90'].map(d => <option key={d} value={d}>{d} dias</option>)}
                </select>
              </div>
            </>
          )}

          {docType === 'personalizada' && (
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block">Texto da declaração</Label>
              <Textarea
                placeholder="Escreva o corpo da declaração. O cabeçalho, data e assinatura serão gerados automaticamente."
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                rows={5}
              />
            </div>
          )}
        </div>

        {emp && !loading && (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg text-sm">
            <User className="h-4 w-4 text-green-600 shrink-0" />
            <span className="font-medium text-green-800">{emp.full_name}</span>
            {emp.position && <span className="text-green-600">— {emp.position}</span>}
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

      {/* Preview */}
      {emp && co && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b bg-gray-50">
            <span className="text-sm font-medium text-gray-600">Prévia — {docLabel}</span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Imprimir / Salvar PDF
            </Button>
          </div>

          <div
            ref={printRef}
            className="p-10 font-serif text-[13px] leading-relaxed text-gray-900 max-w-3xl mx-auto"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {/* Cabeçalho empresa */}
            <div className="text-center mb-8">
              <h2 className="font-bold text-base uppercase tracking-wide">{co.name}</h2>
              {co.cnpj && <p className="text-xs text-gray-500">CNPJ: {co.cnpj}</p>}
              {(co.address || co.city) && (
                <p className="text-xs text-gray-500">{[co.address, co.city, co.state].filter(Boolean).join(', ')}</p>
              )}
            </div>

            {/* Título */}
            <div className="text-center mb-8">
              <div className="border-y-2 border-gray-900 py-2 inline-block px-8">
                <h1 className="font-bold uppercase tracking-widest text-sm">{docLabel}</h1>
              </div>
            </div>

            {/* Corpo */}
            <div className="space-y-4 text-justify" dangerouslySetInnerHTML={{ __html: body }} />

            {/* Data e local */}
            <p className="text-right mt-10">{cityDate}</p>

            {/* Assinatura */}
            <div className="text-center mt-14">
              <div className="border-t border-gray-900 pt-2 w-72 mx-auto">
                <p className="font-semibold text-sm">{co.name}</p>
                {co.legal_representative && <p className="text-xs text-gray-500">{co.legal_representative}</p>}
                <p className="text-xs text-gray-400">Responsável pelo RH</p>
              </div>
            </div>

            {/* Ciente do colaborador (para aviso prévio e férias) */}
            {(docType === 'rescisao_aviso' || docType === 'ferias') && (
              <div className="text-center mt-10">
                <div className="border-t border-gray-900 pt-2 w-72 mx-auto">
                  <p className="font-semibold text-sm">{emp.full_name}</p>
                  {emp.cpf && <p className="text-xs text-gray-400">CPF: {emp.cpf}</p>}
                  <p className="text-xs text-gray-400">Colaborador(a) — Ciente</p>
                </div>
              </div>
            )}

            {/* Rodapé */}
            <div className="mt-10 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
              Documento emitido eletronicamente em {new Date().toLocaleDateString('pt-BR')} · Desenvolvido por GRP Tecnologia
            </div>
          </div>
        </div>
      )}

      {!emp && !loading && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Selecione o tipo de documento e pesquise um colaborador</p>
        </div>
      )}
    </div>
  )
}
