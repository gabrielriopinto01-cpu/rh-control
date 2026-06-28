'use client'

import { useState } from 'react'
import { BookMarked, Search, ChevronDown, ChevronRight, Lightbulb, AlertTriangle, HelpCircle, CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'

const ARTICLES = [
  // ─── Ponto Eletrônico ────────────────────────────────────────────
  {
    category: 'Ponto Eletrônico',
    icon: '🕐',
    articles: [
      {
        title: 'O que é o controle de ponto?',
        body: 'O módulo de Ponto Eletrônico registra entradas e saídas dos colaboradores com GPS, selfie opcional e validação de cerca geográfica. Cada batida é salva com horário, endereço e dispositivo.',
        tips: ['Configure a cerca geográfica em Configurações → Ponto Eletrônico antes de liberar o acesso', 'A selfie pode ser exigida para colaboradores externos'],
        pitfalls: ['Não use o ponto sem configurar o horário esperado — o sistema não saberá calcular atrasos', 'Evite fechar o banco de horas sem revisar os registros manuais'],
      },
      {
        title: 'Como gerar o Espelho de Ponto (Portaria 671)?',
        body: 'Acesse Departamento Pessoal → Espelho de Ponto. Selecione o mês e, opcionalmente, um colaborador. Clique em Gerar / Imprimir. O relatório abre em nova aba pronto para impressão ou PDF.',
        tips: ['O relatório já inclui campos de assinatura do empregador e empregado', 'Faltas aparecem em vermelho, atrasos em amarelo'],
        pitfalls: ['Se o colaborador não tiver registros no mês, as linhas aparecerão em branco — isso é esperado'],
      },
    ],
  },
  // ─── Folha de Pagamento ──────────────────────────────────────────
  {
    category: 'Folha de Pagamento',
    icon: '💰',
    articles: [
      {
        title: 'Como funciona o cálculo da folha?',
        body: 'O sistema calcula INSS progressivo (tabela 2025), IRRF com dedução por dependente (R$189,59/dep), FGTS (8% do bruto) e salário líquido. A folha é gerada por mês de referência e pode ser processada para todos os ativos.',
        tips: ['Atualize os salários base dos colaboradores antes de gerar a folha', 'Use o holerite imprimível em Folha → Holerite para entregar ao colaborador'],
        pitfalls: ['Reabrir uma folha fechada permite edição — cuidado com alterações retroativas'],
      },
      {
        title: 'INSS: por que o valor mudou?',
        body: 'O RH Control usa cálculo progressivo de INSS (não a alíquota fixa de 14%). Cada faixa de salário tem uma alíquota diferente, assim como o Imposto de Renda. Isso é o modelo correto conforme legislação.',
        tips: ['Colaboradores com salário até R$1.518 pagam apenas 7,5% de INSS'],
        pitfalls: [],
      },
    ],
  },
  // ─── Férias ──────────────────────────────────────────────────────
  {
    category: 'Férias',
    icon: '🌴',
    articles: [
      {
        title: 'Fluxo de solicitação de férias',
        body: 'O colaborador solicita férias em Minhas Férias. O RH/gestor aprova ou rejeita em Férias → lista de pedidos. Férias aprovadas entram no calendário e geram alertas automáticos quando próximas.',
        tips: ['Configure o workflow de aprovação em Workflows para exigir aprovação do gestor antes do RH', 'O alerta aparece 30 dias antes do início'],
        pitfalls: ['Férias com menos de 5 dias são permitidas mas precisam de acordo por escrito (guarde no módulo Documentos)'],
      },
    ],
  },
  // ─── Recrutamento / ATS ──────────────────────────────────────────
  {
    category: 'Recrutamento',
    icon: '🎯',
    articles: [
      {
        title: 'Como usar o Kanban de candidatos?',
        body: 'Em Pessoas → Recrutamento, troque para a view Kanban (botão no topo direito). Arraste os cards entre as 6 colunas do pipeline: Candidato → Triagem → Entrevista → Proposta → Contratado → Reprovado.',
        tips: ['Clique no ícone Kanban na linha da vaga para abrir direto o board filtrado por aquela vaga', 'O status atualiza no banco de dados imediatamente ao soltar o card'],
        pitfalls: [],
      },
    ],
  },
  // ─── Benefícios ──────────────────────────────────────────────────
  {
    category: 'Benefícios',
    icon: '🎁',
    articles: [
      {
        title: 'Como vincular um benefício a um colaborador?',
        body: 'Primeiro cadastre o benefício em Pessoas → Benefícios (tipos: VT, VR, Saúde, Odonto, Seguro de Vida, Academia). Depois, na página do colaborador, use a seção Benefícios para vinculá-lo com data de início.',
        tips: ['O campo "Desconto colaborador" é o valor descontado em folha — use isso para calcular o líquido correto', 'Benefícios inativos não aparecem para vincular'],
        pitfalls: ['Não esqueça de desvincular o benefício ao demitir um colaborador'],
      },
    ],
  },
  // ─── OKRs e PDI ─────────────────────────────────────────────────
  {
    category: 'OKRs e PDI',
    icon: '📈',
    articles: [
      {
        title: 'Diferença entre OKR e PDI',
        body: 'OKR (Objetivo e Resultados-Chave) define metas mensuráveis por ciclo (trimestre, semestre). PDI (Plano de Desenvolvimento Individual) define ações de desenvolvimento de longo prazo sem obrigatoriedade de métrica numérica.',
        tips: ['Use ciclos no formato 2026-Q3, 2026-S2 ou 2026 para organizar por período', 'A barra de progresso do OKR é calculada automaticamente como média dos KRs'],
        pitfalls: ['Não confunda KR com tarefa do dia a dia — KR deve ser um resultado mensurável, não uma atividade'],
      },
    ],
  },
  // ─── LGPD ───────────────────────────────────────────────────────
  {
    category: 'LGPD e Conformidade',
    icon: '🔒',
    articles: [
      {
        title: 'Como exportar dados do colaborador (portabilidade LGPD)?',
        body: 'Na página de detalhes do colaborador, clique no botão LGPD. O sistema gera um JSON com todos os dados pessoais do colaborador em 9 categorias (documentos, férias, folha, ponto, avaliações, atestados, afastamentos, treinamentos, equipamentos). O CPF é mascarado.',
        tips: ['O arquivo é gerado conforme LGPD Art. 18 — direito de portabilidade', 'Guarde o comprovante de entrega ao titular'],
        pitfalls: [],
      },
    ],
  },
  // ─── Workflows ──────────────────────────────────────────────────
  {
    category: 'Workflows de Aprovação',
    icon: '✅',
    articles: [
      {
        title: 'Como funciona a aprovação de solicitações?',
        body: 'Workflows centralizados em Administração → Workflows. Toda solicitação pendente (férias, ajuste de ponto, afastamento) aparece aqui. Gestor/RH/adm podem aprovar ou reprovar com comentário. Reprovações exigem justificativa.',
        tips: ['Filtre por "Pendentes" para focar no que precisa de ação', 'Ao aprovar férias via workflow, o status na tabela de férias é atualizado automaticamente'],
        pitfalls: ['Apenas gestor, RH e adm_total podem aprovar — o colaborador só vê o status das próprias solicitações'],
      },
    ],
  },
  // ─── Automações WhatsApp ─────────────────────────────────────────
  {
    category: 'Automações WhatsApp',
    icon: '🤖',
    articles: [
      {
        title: 'Como configurar mensagens automáticas?',
        body: 'Acesse Configurações → Automações WhatsApp. O sistema tem 7 regras padrão: férias aprovadas/recusadas, nova solicitação, admissão, aniversário, documento vencendo e folha fechada. Cada regra pode ser ativada/desativada individualmente e ter seu template editado.',
        tips: [
          'Use {{nome}}, {{inicio}}, {{fim}}, {{dias}}, {{motivo}}, {{mes}}, {{documento}}, {{data}} como variáveis no template',
          'Aniversários e documentos vencendo são verificados automaticamente todos os dias às 8h',
          'O histórico dos últimos 50 envios fica disponível no rodapé da seção',
        ],
        pitfalls: [
          'As automações só funcionam se o WhatsApp estiver conectado em Configurações → WhatsApp',
          'O telefone do colaborador precisa estar cadastrado no campo "Celular" do perfil dele',
        ],
      },
      {
        title: 'Quais eventos disparam automações?',
        body: 'Existem 7 eventos: (1) Férias aprovadas — envia ao colaborador; (2) Férias recusadas — envia ao colaborador com motivo; (3) Nova solicitação — avisa o RH; (4) Colaborador admitido — boas-vindas com link do sistema; (5) Aniversário — alerta diário ao RH; (6) Documento vencendo — alerta 30 dias antes; (7) Folha fechada — confirmação ao RH.',
        tips: ['Você pode criar regras com send_to = "all" para avisar colaborador E gestor simultaneamente'],
        pitfalls: [],
      },
    ],
  },
  // ─── Portal de Vagas ─────────────────────────────────────────────
  {
    category: 'Portal de Vagas Público',
    icon: '🌐',
    articles: [
      {
        title: 'Como compartilhar vagas com candidatos externos?',
        body: 'Em Pessoas → Recrutamento, clique no botão "Portal de vagas" (canto superior direito). Isso abre o portal público da empresa com todas as vagas abertas. Candidatos externos podem visualizar os detalhes de cada vaga e enviar sua candidatura diretamente pelo site — sem precisar de login.',
        tips: [
          'O portal é acessível pelo link /careers/[id-da-empresa] — compartilhe em redes sociais, LinkedIn ou site da empresa',
          'Apenas vagas com status "Aberta" aparecem no portal',
          'As candidaturas externas entram automaticamente no Kanban de recrutamento na coluna "Candidato"',
        ],
        pitfalls: ['Vagas pausadas ou encerradas não aparecem no portal externo'],
      },
    ],
  },
  // ─── Busca Rápida ────────────────────────────────────────────────
  {
    category: 'Navegação e Busca Rápida',
    icon: '⌨️',
    articles: [
      {
        title: 'Como usar o atalho de teclado ⌘K / Ctrl+K?',
        body: 'Pressione ⌘K (Mac) ou Ctrl+K (Windows) de qualquer página para abrir a paleta de comandos. Você pode navegar para qualquer seção do sistema digitando parte do nome — sem precisar usar o menu lateral.',
        tips: [
          'Pressionar "/" também abre a paleta (exceto quando o foco está em um campo de texto)',
          'A busca é por nome do módulo — experimente "Folha", "Ponto", "OKR", "IA"',
          'A paleta agrupa os resultados por seção (Pessoas, DP, Inteligência, etc.)',
        ],
        pitfalls: [],
      },
    ],
  },
  // ─── IA / Assistente ────────────────────────────────────────────
  {
    category: 'Assistente de IA',
    icon: '🧠',
    articles: [
      {
        title: 'Como usar o Assistente de IA?',
        body: 'O módulo IA (menu lateral → IA / Assistente) usa Claude da Anthropic para responder perguntas sobre RH, gerar descrições de vagas, redigir comunicados, analisar absenteísmo e criar avaliações de desempenho. No modo "Chat Geral", o assistente recebe contexto real da empresa (headcount, férias, aprovações, OKRs, etc.).',
        tips: [
          'Use a ferramenta "Descrição de vaga" para gerar JDs completos em segundos',
          'O assistente tem acesso ao contexto da empresa no modo Chat — pergunte "Quem faz aniversário essa semana?"',
          'Shift+Enter para quebrar linha, Enter para enviar',
        ],
        pitfalls: ['O assistente não tem acesso a dados pessoais como salários individuais por privacidade'],
      },
    ],
  },
]

type Article = { title: string; body: string; tips: string[]; pitfalls: string[] }

function ArticleCard({ article }: { article: Article }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="font-medium text-sm">{article.title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t bg-muted/10">
          <p className="text-sm text-foreground mt-3 leading-relaxed">{article.body}</p>
          {article.tips.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-green-700 flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" /> Dicas</p>
              {article.tips.map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-green-800 bg-green-50 rounded px-2 py-1.5">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600" />{t}
                </div>
              ))}
            </div>
          )}
          {article.pitfalls.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-orange-700 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Erros comuns</p>
              {article.pitfalls.map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-orange-800 bg-orange-50 rounded px-2 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-500" />{p}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConhecimentoPage() {
  const [search, setSearch] = useState('')

  const filtered = ARTICLES
    .map(cat => ({
      ...cat,
      articles: cat.articles.filter(a =>
        !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.body.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(cat => cat.articles.length > 0)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookMarked className="h-6 w-6" /> Centro de Conhecimento
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Guias, dicas e boas práticas do RH Control</p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar em todos os artigos..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum artigo encontrado para "{search}"</p>
        </div>
      ) : (
        filtered.map(cat => (
          <div key={cat.category}>
            <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
              <span>{cat.icon}</span> {cat.category}
            </h2>
            <div className="space-y-2">
              {cat.articles.map(a => <ArticleCard key={a.title} article={a} />)}
            </div>
          </div>
        ))
      )}

      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        Desenvolvido por GRP Tecnologia · RH Control
      </div>
    </div>
  )
}
