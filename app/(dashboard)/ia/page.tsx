'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Sparkles, Briefcase, UserSearch, TrendingDown, MessageSquareHeart,
  FileText, Users, ClipboardCheck, Send, Loader2, RotateCcw, Copy, Check,
  Scale, BarChart2, Smile,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

export const dynamic = 'force-dynamic'

type Msg = { role: 'user' | 'assistant'; content: string }

const TOOLS = [
  { key: 'chat',             Icon: Sparkles,          label: 'Chat livre',           placeholder: 'Pergunte qualquer coisa sobre RH, CLT, gestão de pessoas...' },
  { key: 'job_description',  Icon: Briefcase,          label: 'Descrição de cargo',   placeholder: 'Ex: Cargo de Analista de RH Pleno, empresa de tecnologia, 3 anos de experiência, foco em recrutamento...' },
  { key: 'feedback',         Icon: MessageSquareHeart, label: 'Feedback construtivo', placeholder: 'Ex: Colaborador João, entregou o projeto atrasado 2x este mês, mas tem boa relação com a equipe...' },
  { key: 'announcement',     Icon: FileText,           label: 'Comunicado interno',   placeholder: 'Ex: Comunicar mudança de horário de trabalho a partir de julho, horário novo das 9h às 18h...' },
  { key: 'absenteeism',      Icon: TrendingDown,       label: 'Análise de absenteísmo', placeholder: 'Ex: Departamento de logística, 15% de faltas em maio, pico às segundas-feiras...' },
  { key: 'performance_review', Icon: ClipboardCheck,  label: 'Avaliação de desempenho', placeholder: 'Ex: Maria Silva, atingiu 90% das metas, feedback positivo dos clientes, precisa melhorar comunicação escrita...' },
  { key: 'candidate_summary', Icon: UserSearch,        label: 'Triagem de candidato', placeholder: 'Cole o currículo ou descreva o candidato aqui...' },
  { key: 'clt_question',     Icon: Scale,              label: 'Dúvida trabalhista',   placeholder: 'Ex: Qual o prazo para pagamento das verbas rescisórias? / Como calcular FGTS na demissão sem justa causa?' },
  { key: 'survey_questions', Icon: Smile,              label: 'Pesquisa de clima',    placeholder: 'Ex: Pesquisa de clima organizacional para equipe de TI, foco em liderança e trabalho remoto, 10 perguntas...' },
  { key: 'salary_benchmark', Icon: BarChart2,          label: 'Benchmark salarial',   placeholder: 'Ex: Qual a faixa salarial para Analista de TI Pleno em São Paulo? / Compare salários de gestores no setor de saúde...' },
] as const

type ToolKey = typeof TOOLS[number]['key']

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export default function IAPage() {
  const [activeTool, setActiveTool] = useState<ToolKey>('chat')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const currentTool = TOOLS.find(t => t.key === activeTool)!

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const changeTool = (key: ToolKey) => {
    setActiveTool(key)
    setMessages([])
    setInput('')
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg: Msg = { role: 'user', content: text }
    const newMessages: Msg[] = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, tool: activeTool }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Erro ao consultar IA')
        setMessages(prev => prev.slice(0, -1)) // remove user msg se erro
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
      }
    } catch {
      toast.error('Erro de conexão com a IA')
      setMessages(prev => prev.slice(0, -1))
    }
    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 -mx-4 sm:-mx-6 -my-4 sm:-my-6 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Sidebar de ferramentas */}
      <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col py-4 gap-1 px-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Ferramentas</p>
        {TOOLS.map(({ key, Icon, label }) => (
          <button key={key} onClick={() => changeTool(key)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left w-full ${
              activeTool === key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}>
            <Icon className="h-4 w-4 shrink-0" />
            <span className="leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header do chat */}
        <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <currentTool.Icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{currentTool.label}</p>
              <p className="text-xs text-gray-400">Powered by Claude Haiku</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Limpar
            </button>
          )}
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-gray-400">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                <currentTool.Icon className="h-8 w-8 text-indigo-500" />
              </div>
              <div>
                <p className="font-medium text-gray-700">{currentTool.label}</p>
                <p className="text-sm mt-1 max-w-xs">{currentTool.placeholder}</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
              }`}>
                {msg.role === 'user' ? 'Eu' : <Sparkles className="h-4 w-4" />}
              </div>
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="text-sm">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        h1: ({ children }) => <h1 className="text-base font-bold mb-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                        code: ({ children }) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                      }}
                    >{msg.content}</ReactMarkdown>
                  ) : msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 px-1">
                    <CopyButton text={msg.content} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white px-6 py-4">
          <div className="flex gap-3 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={messages.length === 0 ? currentTool.placeholder : 'Continue a conversa... (Enter para enviar, Shift+Enter para nova linha)'}
              rows={3}
              className="resize-none flex-1 text-sm"
            />
            <Button onClick={send} disabled={!input.trim() || loading}
              className="h-10 w-10 p-0 bg-indigo-600 hover:bg-indigo-700 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            RH Control IA · Powered by Claude · Respostas podem conter erros — sempre revise antes de aplicar.
          </p>
        </div>
      </div>
    </div>
  )
}
