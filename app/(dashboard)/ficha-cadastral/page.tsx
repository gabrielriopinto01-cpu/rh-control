'use client'

import { useEffect, useState } from 'react'
import { FileUser, Printer, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useBrandingStore } from '@/store/branding-store'

export const dynamic = 'force-dynamic'

type Employee = {
  id: string; full_name: string; employee_code?: string; cpf?: string
  rg?: string; rg_issuer?: string; birth_date?: string; gender?: string
  marital_status?: string; nationality?: string; education?: string
  phone?: string; email?: string; address?: string; address_city?: string
  address_state?: string; address_zip?: string
  hire_date?: string; salary?: number; status?: string
  position?: { title?: string }
  department?: { name?: string }
  company?: { name?: string; cnpj?: string; address?: string }
}

const GENDER: Record<string, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro' }
const MARITAL: Record<string, string> = {
  single: 'Solteiro(a)', married: 'Casado(a)', divorced: 'Divorciado(a)',
  widowed: 'Viúvo(a)', stable_union: 'União Estável',
}
const EDU: Record<string, string> = {
  fundamental: 'Ensino Fundamental', medio: 'Ensino Médio',
  tecnico: 'Técnico', superior: 'Ensino Superior',
  pos_graduacao: 'Pós-Graduação', mestrado: 'Mestrado', doutorado: 'Doutorado',
}

function fmt(v?: string | null) { return v ?? '_______________' }
function fmtDate(v?: string | null) {
  if (!v) return '_______________'
  return new Date(v + 'T00:00:00').toLocaleDateString('pt-BR')
}
function fmtBrl(v?: number | null) {
  if (v == null) return '_______________'
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export default function FichaCadastralPage() {
  const { user } = useAuth()
  const { companyName } = useBrandingStore()
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<{ id: string; full_name: string }[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [searching,setSearching]= useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured() || !user || query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await createClient()
        .from('employees')
        .select('id, full_name')
        .eq('company_id', user.company_id)
        .ilike('full_name', `%${query}%`)
        .limit(8)
      setResults(data ?? [])
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query, user])

  const pick = async (id: string) => {
    setResults([])
    setQuery('')
    setLoading(true)
    const { data } = await createClient()
      .from('employees')
      .select(`
        id, full_name, employee_code, cpf, rg, rg_issuer, birth_date, gender,
        marital_status, nationality, education, phone, email,
        address, address_city, address_state, address_zip,
        hire_date, salary, status,
        position:positions(title),
        department:departments(name),
        company:companies(name, cnpj, address)
      `)
      .eq('id', id)
      .single()
    setSelected(data as Employee)
    setLoading(false)
  }

  const print = () => {
    if (!selected) return
    const e = selected
    const co = e.company as any
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Ficha Cadastral — ${e.full_name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20mm 15mm;background:#fff}
  h1{font-size:16px;text-align:center;margin-bottom:2px}
  .subtitle{text-align:center;font-size:11px;color:#555;margin-bottom:12px}
  .section{margin-bottom:10px}
  .section-title{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;
    border-bottom:1.5px solid #333;padding-bottom:2px;margin-bottom:6px;margin-top:10px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 12px}
  .grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px}
  .field label{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.3px}
  .field p{border-bottom:0.5px solid #ccc;padding-bottom:1px;min-height:16px;font-size:11px}
  .sig{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:30px}
  .sig-line{border-top:0.5px solid #555;padding-top:4px;text-align:center;font-size:10px;color:#444}
  .disclaimer{margin-top:20px;font-size:8px;color:#888;text-align:center;border-top:0.5px solid #ddd;padding-top:6px}
  @media print{@page{margin:15mm}}
</style></head><body>
<h1>${co?.name ?? companyName ?? 'Empresa'}</h1>
<div class="subtitle">FICHA DE REGISTRO DE EMPREGADO — CLT Art. 41<br>
  ${co?.cnpj ? `CNPJ: ${co.cnpj}` : ''}${co?.address ? ` | ${co.address}` : ''}
</div>

<div class="section-title">Identificação</div>
<div class="grid">
  <div class="field"><label>Nome completo</label><p>${fmt(e.full_name)}</p></div>
  <div class="field"><label>Matrícula</label><p>${fmt(e.employee_code)}</p></div>
  <div class="field"><label>Status</label><p>${e.status === 'active' ? 'Ativo' : e.status ?? '—'}</p></div>
  <div class="field"><label>CPF</label><p>${fmt(e.cpf)}</p></div>
  <div class="field"><label>RG</label><p>${fmt(e.rg)}</p></div>
  <div class="field"><label>Órgão emissor</label><p>${fmt(e.rg_issuer)}</p></div>
  <div class="field"><label>Data de nascimento</label><p>${fmtDate(e.birth_date)}</p></div>
  <div class="field"><label>Sexo</label><p>${GENDER[e.gender ?? ''] ?? fmt(null)}</p></div>
  <div class="field"><label>Estado civil</label><p>${MARITAL[e.marital_status ?? ''] ?? fmt(null)}</p></div>
  <div class="field"><label>Nacionalidade</label><p>${fmt(e.nationality)}</p></div>
  <div class="field"><label>Escolaridade</label><p>${EDU[e.education ?? ''] ?? fmt(null)}</p></div>
</div>

<div class="section-title">Contato e endereço</div>
<div class="grid">
  <div class="field"><label>Telefone</label><p>${fmt(e.phone)}</p></div>
  <div class="field"><label>E-mail</label><p>${fmt(e.email)}</p></div>
  <div class="field"><label>CEP</label><p>${fmt(e.address_zip)}</p></div>
</div>
<div style="margin-top:6px" class="grid-2">
  <div class="field"><label>Endereço</label><p>${fmt(e.address)}</p></div>
  <div class="field"><label>Cidade / Estado</label><p>${[e.address_city, e.address_state].filter(Boolean).join(' / ') || '_______________'}</p></div>
</div>

<div class="section-title">Vínculo empregatício</div>
<div class="grid">
  <div class="field"><label>Cargo</label><p>${(e.position as any)?.title ?? '_______________'}</p></div>
  <div class="field"><label>Departamento</label><p>${(e.department as any)?.name ?? '_______________'}</p></div>
  <div class="field"><label>Data de admissão</label><p>${fmtDate(e.hire_date)}</p></div>
  <div class="field"><label>Salário base</label><p>${fmtBrl(e.salary)}</p></div>
  <div class="field"><label>Tipo de contrato</label><p>CLT — Art. 443</p></div>
  <div class="field"><label>Jornada</label><p>44h semanais — Art. 58</p></div>
</div>

<div class="sig">
  <div class="sig-line">Local e data: _____________________ / ____/____/________</div>
  <div></div>
  <div class="sig-line">Assinatura do empregador</div>
  <div class="sig-line">Assinatura do empregado</div>
</div>

<div class="disclaimer">
  Documento gerado pelo RH Control em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}.
  Ficha cadastral obrigatória conforme CLT Art. 41 e Portaria MTE 671/2021.
</div>
</body></html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.print() }, 400)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileUser className="h-6 w-6" /> Ficha Cadastral
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Impressão da ficha de registro do empregado — CLT Art. 41
        </p>
      </div>

      {/* Busca */}
      <div className="space-y-1.5 relative">
        <Label>Buscar colaborador</Label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Digite o nome..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {searching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {results.length > 0 && (
          <div className="absolute z-10 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg overflow-hidden">
            {results.map(r => (
              <button key={r.id} onClick={() => pick(r.id)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors">
                {r.full_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>}

      {selected && !loading && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-lg">{selected.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {(selected.position as any)?.title ?? '—'} · {(selected.department as any)?.name ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Matrícula: {selected.employee_code ?? '—'} · Admissão: {fmtDate(selected.hire_date)}
              </p>
            </div>
            <Button onClick={print} className="shrink-0">
              <Printer className="h-4 w-4 mr-2" /> Imprimir / PDF
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm border-t pt-4">
            <div><p className="text-xs text-muted-foreground">CPF</p><p>{fmt(selected.cpf)}</p></div>
            <div><p className="text-xs text-muted-foreground">RG</p><p>{fmt(selected.rg)}</p></div>
            <div><p className="text-xs text-muted-foreground">Nascimento</p><p>{fmtDate(selected.birth_date)}</p></div>
            <div><p className="text-xs text-muted-foreground">Estado civil</p><p>{MARITAL[selected.marital_status ?? ''] ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Telefone</p><p>{fmt(selected.phone)}</p></div>
            <div><p className="text-xs text-muted-foreground">E-mail</p><p>{fmt(selected.email)}</p></div>
            <div className="col-span-2"><p className="text-xs text-muted-foreground">Endereço</p>
              <p>{[selected.address, selected.address_city, selected.address_state].filter(Boolean).join(', ') || '—'}</p>
            </div>
            <div><p className="text-xs text-muted-foreground">Salário</p><p>{fmtBrl(selected.salary)}</p></div>
            <div><p className="text-xs text-muted-foreground">Escolaridade</p><p>{EDU[selected.education ?? ''] ?? '—'}</p></div>
          </div>
        </div>
      )}

      {!selected && !loading && (
        <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
          <FileUser className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Busque um colaborador para gerar a ficha</p>
        </div>
      )}
    </div>
  )
}
