'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, Clock, MessageSquare, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  vacation:        'Férias',
  time_adjustment: 'Ajuste de Ponto',
  leave:           'Afastamento',
  other:           'Outro',
}

const STATUS_CONFIG = {
  pending:   { label: 'Pendente',  variant: 'secondary' as const, Icon: Clock },
  approved:  { label: 'Aprovado', variant: 'default'   as const, Icon: CheckCircle },
  rejected:  { label: 'Reprovado',variant: 'destructive'as const, Icon: XCircle },
  cancelled: { label: 'Cancelado',variant: 'outline'   as const, Icon: XCircle },
}

type Request = {
  id: string; type: string; status: string; created_at: string; resolved_at?: string
  payload: any; employee?: { full_name: string; employee_code?: string }
  rejection_reason?: string
  actions?: Array<{ action: string; comment?: string; created_at: string; approver?: { email: string }; approver_role: string }>
}

export default function WorkflowsPage() {
  const { user } = useAuth()
  const [requests,  setRequests]  = useState<Request[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('pending')
  const [selected,  setSelected]  = useState<Request | null>(null)
  const [comment,   setComment]   = useState('')
  const [acting,    setActing]    = useState(false)

  const isApprover = user && ['adm_total', 'rh', 'gestor'].includes(user.role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/approvals?status=${filter}`)
      if (res.ok) setRequests(await res.json())
    } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function handleAction(action: 'approve' | 'reject') {
    if (!selected) return
    if (action === 'reject' && !comment.trim()) { toast.error('Informe o motivo da reprovação'); return }
    setActing(true)
    try {
      const res = await fetch(`/api/approvals/${selected.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      })
      if (!res.ok) { toast.error('Erro ao processar'); return }
      toast.success(action === 'approve' ? 'Aprovado!' : 'Reprovado')
      setSelected(null); setComment(''); load()
    } finally { setActing(false) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows de Aprovação</h1>
          <p className="text-muted-foreground text-sm mt-1">Pedidos que precisam de aprovação</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'pending',  label: 'Pendentes' },
          { value: 'approved', label: 'Aprovados' },
          { value: 'rejected', label: 'Reprovados' },
          { value: 'all',      label: 'Todos' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${filter === f.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum pedido {filter !== 'all' ? STATUS_CONFIG[filter as keyof typeof STATUS_CONFIG]?.label.toLowerCase() : ''}</p>
          </div>
        ) : requests.map(r => {
          const sc = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
          return (
            <div
              key={r.id}
              className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow-sm cursor-pointer transition-shadow"
              onClick={() => { setSelected(r); setComment('') }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <sc.Icon className={`h-5 w-5 shrink-0 ${r.status === 'approved' ? 'text-green-500' : r.status === 'rejected' ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.employee?.full_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[r.type] ?? r.type} · {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </p>
                  {r.payload?.reason && <p className="text-xs text-muted-foreground truncate">{r.payload.reason}</p>}
                </div>
              </div>
              <Badge variant={sc.variant}>{sc.label}</Badge>
            </div>
          )
        })}
      </div>

      {/* Dialog detalhe + ação */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selected && (TYPE_LABELS[selected.type] ?? selected.type)} — {selected?.employee?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 pt-1">
              {/* Dados */}
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                {Object.entries(selected.payload ?? {}).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-muted-foreground capitalize">{k.replace(/_/g,' ')}:</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Solicitado em:</span>
                  <span>{new Date(selected.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {/* Histórico */}
              {(selected.actions?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Histórico</p>
                  <div className="space-y-2">
                    {selected.actions!.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {a.action === 'approve'
                          ? <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                        <div>
                          <span className="font-medium">{a.approver_role}</span>
                          <span className="text-muted-foreground"> · {new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                          {a.comment && <p className="text-muted-foreground">{a.comment}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ação (só aprovadores, pedido pendente) */}
              {isApprover && selected.status === 'pending' && (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Comentário / Motivo
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="Opcional para aprovação, obrigatório para reprovação"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => handleAction('approve')} disabled={acting} className="flex-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-4 w-4 mr-2" /> Aprovar
                    </Button>
                    <Button onClick={() => handleAction('reject')} disabled={acting} variant="destructive" className="flex-1">
                      <XCircle className="h-4 w-4 mr-2" /> Reprovar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
