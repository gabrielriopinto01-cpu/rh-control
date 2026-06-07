import Link from 'next/link'
import {
  Users, Clock, DollarSign, FileText, PenLine, Megaphone,
  Network, CalendarDays, Shield, CheckCircle2, ArrowRight,
  Star, Zap, Palmtree, BarChart3, TrendingUp,
} from 'lucide-react'

export const metadata = {
  title: 'RH Control — Sistema de RH para pequenas e médias empresas',
  description: 'Gerencie colaboradores, folha de pagamento, ponto, férias, documentos e muito mais. Simples, moderno e acessível.',
}

const FEATURES = [
  { icon: Users,        title: 'Gestão de Colaboradores',  desc: 'Cadastro completo com documentos, cargos, departamentos e histórico.' },
  { icon: Clock,        title: 'Controle de Ponto',        desc: 'Registro com geolocalização, banco de horas e horas extras calculadas.' },
  { icon: DollarSign,   title: 'Folha de Pagamento',       desc: 'Cálculo automático de INSS, IRRF, 13º salário e verbas extras.' },
  { icon: Palmtree,     title: 'Gestão de Férias',         desc: 'Saldo CLT, solicitação online e aprovação com notificação automática.' },
  { icon: PenLine,      title: 'Assinatura Digital',       desc: 'Contratos, advertências e termos assinados digitalmente pelo celular.' },
  { icon: Megaphone,    title: 'Comunicados Internos',     desc: 'Avisos por departamento com confirmação de leitura registrada.' },
  { icon: Network,      title: 'Organograma',              desc: 'Visualize a estrutura da empresa de forma clara e interativa.' },
  { icon: CalendarDays, title: 'Calendário da Equipe',     desc: 'Férias, aniversários, feriados e eventos num calendário unificado.' },
  { icon: Shield,       title: 'Log de Auditoria',         desc: 'Rastreio completo de todas as ações: quem fez, quando e de onde.' },
  { icon: FileText,     title: 'Gestão de Documentos',     desc: 'Armazene e controle documentos dos colaboradores com segurança.' },
  { icon: TrendingUp,   title: 'Avaliação de Desempenho',  desc: 'Ciclos de performance, metas e feedback estruturado.' },
  { icon: BarChart3,    title: 'Relatórios Gerenciais',    desc: 'Dashboards e exportações para tomada de decisão com dados reais.' },
]

const PLANS = [
  {
    name: 'Starter', price: '97', desc: 'Ideal para pequenas empresas', highlight: false,
    features: ['Até 10 colaboradores', 'Folha de pagamento', 'Controle de ponto', 'Férias e rescisão', 'App mobile (PWA)', 'Suporte por e-mail'],
  },
  {
    name: 'Professional', price: '197', desc: 'Para equipes em crescimento', highlight: true,
    features: ['Até 50 colaboradores', 'Tudo do Starter', 'Assinatura digital', '13º automático', 'Calendário de equipe', 'Log de auditoria', 'Organograma', 'Comunicados internos', 'Suporte prioritário'],
  },
  {
    name: 'Enterprise', price: '497', desc: 'Para empresas maiores', highlight: false,
    features: ['Colaboradores ilimitados', 'Tudo do Professional', 'Multi-empresa', 'API de integração', 'Onboarding dedicado', 'SLA 99,9%', 'Gerente de conta'],
  },
]

const TESTIMONIALS = [
  { name: 'Dra. Ana Lima',     role: 'Clínica Saúde Plena',              text: 'Antes usávamos planilha e WhatsApp. O RH Control centralizou tudo. Em 30 minutos meu time estava usando.' },
  { name: 'Marcos Ribeiro',    role: 'Escritório Ribeiro & Advogados',    text: 'A assinatura digital economizou horas por mês. Os contratos chegam assinados no mesmo dia.' },
  { name: 'Carla Mendes',      role: 'Laboratório BioLab',                text: 'O ponto digital com geolocalização resolveu um problema que tínhamos há anos com funcionários externos.' },
]

const SEGMENTS = [
  { icon: '🏥', label: 'Clínicas e consultórios' },
  { icon: '⚖️', label: 'Escritórios de advocacia' },
  { icon: '🔬', label: 'Laboratórios' },
  { icon: '💻', label: 'Empresas de TI' },
  { icon: '🏗️', label: 'Construção civil' },
  { icon: '🛒', label: 'Varejo e serviços' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">RH</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">RH Control</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#funcionalidades" className="hover:text-blue-600 transition-colors">Funcionalidades</a>
            <a href="#segmentos"       className="hover:text-blue-600 transition-colors">Para quem é</a>
            <a href="#planos"          className="hover:text-blue-600 transition-colors">Planos</a>
            <a href="#depoimentos"     className="hover:text-blue-600 transition-colors">Depoimentos</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium hidden sm:block">Entrar</Link>
            <Link href="/register"
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Começar grátis <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 sm:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-full px-4 py-1.5 mb-8">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-blue-300 text-sm font-medium">Assinatura Digital · Organograma · Comunicados</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-6 max-w-4xl mx-auto">
            O RH que sua empresa{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              precisa hoje
            </span>
          </h1>
          <p className="text-slate-300 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Gerencie colaboradores, ponto, folha, férias e documentos num sistema moderno,
            simples e acessível — do celular ou computador.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all hover:scale-105 shadow-lg shadow-blue-900/50">
              Começar grátis por 14 dias <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-4 rounded-xl text-base transition-all border border-white/20">
              Já tenho conta
            </Link>
          </div>
          <p className="text-slate-500 text-sm mt-5">Sem cartão de crédito · Cancele quando quiser · Dados no Brasil</p>
          <div className="flex items-center justify-center gap-6 mt-14 flex-wrap">
            {['14 dias grátis', 'Setup em 5 min', 'Suporte em PT-BR', 'LGPD compliant'].map(b => (
              <div key={b} className="flex items-center gap-1.5 text-slate-400 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /> {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Segmentos */}
      <section id="segmentos" className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-8">Perfeito para</p>
          <div className="flex flex-wrap justify-center gap-4">
            {SEGMENTS.map(s => (
              <div key={s.label}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
                <span>{s.icon}</span> {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">Tudo que o RH precisa, num só lugar</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Mais de 15 módulos integrados. Da admissão à rescisão.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="group bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Destaque Assinatura Digital */}
      <section className="py-24 bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-xs font-semibold mb-4">
                <PenLine className="h-3.5 w-3.5" /> Destaque
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-5">
                Assinatura digital com validade jurídica
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-8">
                Envie contratos, advertências e termos LGPD para o colaborador assinar pelo celular.
                Sem impressora, sem deslocamento, sem burocracia.
              </p>
              <ul className="space-y-3 mb-8">
                {['Link seguro por e-mail ou WhatsApp', 'Colaborador assina em qualquer dispositivo', 'Registro de data, hora e IP', 'Trilha de auditoria completa', 'Documentos armazenados na nuvem'].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-gray-700">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                Testar agora <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {/* Mock UI */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 rounded-xl"><PenLine className="h-6 w-6 text-indigo-600" /></div>
                <div>
                  <p className="font-bold text-gray-900">Contrato de Trabalho</p>
                  <p className="text-sm text-gray-500">Empresa Exemplo LTDA</p>
                </div>
              </div>
              {[
                { label: 'Colaborador', value: 'João da Silva' },
                { label: 'Tipo',       value: 'Contrato de Trabalho' },
                { label: 'Válido até', value: '15/07/2025' },
                { label: 'Status',     value: '✅ Assinado', green: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className={`text-sm font-semibold ${(row as any).green ? 'text-green-600' : 'text-gray-900'}`}>{row.value}</span>
                </div>
              ))}
              <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-green-700 font-semibold text-sm">Assinado digitalmente</p>
                <p className="text-green-500 text-xs mt-0.5">08/06/2025 · 14:32 · IP registrado</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">Quem usa, recomenda</h2>
          <p className="text-gray-500 text-lg mb-16">Empresas que deixaram a planilha para trás</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-left">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-24 bg-gradient-to-br from-slate-900 to-blue-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Planos e preços</h2>
          <p className="text-slate-400 text-lg mb-16">Comece grátis. Sem cartão de crédito.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map(plan => (
              <div key={plan.name}
                className={`rounded-2xl p-8 text-left ${plan.highlight ? 'bg-white shadow-2xl shadow-blue-500/30 scale-105' : 'bg-white/5 border border-white/10'}`}>
                {plan.highlight && (
                  <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-bold mb-4">
                    <Star className="h-3 w-3 fill-current" /> Mais popular
                  </div>
                )}
                <h3 className={`text-xl font-black mb-1 ${plan.highlight ? 'text-gray-900' : 'text-white'}`}>{plan.name}</h3>
                <p className={`text-sm mb-5 ${plan.highlight ? 'text-gray-500' : 'text-slate-400'}`}>{plan.desc}</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className={`text-4xl font-black ${plan.highlight ? 'text-gray-900' : 'text-white'}`}>R${plan.price}</span>
                  <span className={`text-sm mb-1 ${plan.highlight ? 'text-gray-400' : 'text-slate-500'}`}>/mês</span>
                </div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${plan.highlight ? 'text-blue-600' : 'text-green-400'}`} />
                      <span className={plan.highlight ? 'text-gray-700' : 'text-slate-300'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${plan.highlight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'}`}>
                  Começar grátis
                </Link>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-sm mt-10">
            Dúvidas? <a href="mailto:contato@rhcontrol.com.br" className="text-blue-400 hover:text-blue-300 underline">contato@rhcontrol.com.br</a>
          </p>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">Pronto para transformar o RH?</h2>
          <p className="text-gray-500 text-lg mb-8">Configure em 5 minutos. Sem complicação.</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-4 rounded-xl text-base transition-all hover:scale-105 shadow-lg shadow-blue-200">
            Criar conta gratuita <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-gray-400 text-sm mt-4">14 dias grátis · Sem cartão · Cancele quando quiser</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-xs">RH</span>
              </div>
              <span className="text-white font-bold">RH Control</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm justify-center">
              <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
              <a href="#planos"          className="hover:text-white transition-colors">Planos</a>
              <Link href="/login"        className="hover:text-white transition-colors">Entrar</Link>
              <Link href="/register"     className="hover:text-white transition-colors">Cadastrar</Link>
              <a href="mailto:contato@rhcontrol.com.br" className="hover:text-white transition-colors">Contato</a>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
            <p>© {new Date().getFullYear()} RH Control. Todos os direitos reservados.</p>
            <p>Feito com 🤖 + ☕ no Brasil · LGPD Compliant</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
