'use client'

import { useState } from 'react'
import { Mail, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  payrollItemId: string
  employeeEmail?: string | null
  size?: 'sm' | 'default'
}

export function EmailHoleriteButton({ payrollItemId, employeeEmail, size = 'sm' }: Props) {
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)

  if (!employeeEmail) return null

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/email/holerite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payrollItemId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSent(true)
      toast.success(`Holerite enviado para ${employeeEmail}`)
      setTimeout(() => setSent(false), 5000)
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao enviar e-mail')
    } finally {
      setSending(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleSend}
      disabled={sending}
      title={`Enviar holerite para ${employeeEmail}`}
      className={sent ? 'text-green-600' : 'text-gray-400 hover:text-blue-600'}
    >
      {sending ? (
        <span className="animate-spin text-xs">⟳</span>
      ) : sent ? (
        <Check className="h-4 w-4" />
      ) : (
        <Mail className="h-4 w-4" />
      )}
    </Button>
  )
}
