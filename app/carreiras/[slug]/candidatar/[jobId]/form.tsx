'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

export default function CandidatarForm({ jobId, jobTitle, companyName }: {
  jobId: string; jobTitle: string; companyName: string
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email) { setError('Nome e e-mail são obrigatórios'); return }
    setSending(true); setError('')
    const res = await fetch('/api/careers/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_opening_id: jobId, name: form.name, email: form.email, phone: form.phone, notes: form.message }),
    })
    setSending(false)
    if (res.ok) { setSent(true) } else { setError('Erro ao enviar candidatura. Tente novamente.') }
  }

  if (sent) {
    return (
      <div className="text-center py-16 space-y-3">
        <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Candidatura enviada!</h2>
        <p className="text-gray-500 text-sm">Obrigado, {form.name}. Entraremos em contato em breve.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-gray-900">Sua candidatura</h2>
        <p className="text-sm text-gray-500 mt-0.5">Preencha seus dados para se candidatar à vaga <strong>{jobTitle}</strong></p>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Nome completo *</label>
        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Seu nome" required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">E-mail *</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="seu@email.com" required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">WhatsApp</label>
          <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="(11) 99999-9999"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Mensagem / Por que se candidata?</label>
        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          rows={4} placeholder="Fale um pouco sobre você e sua experiência..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <button type="submit" disabled={sending}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors text-sm">
        {sending ? 'Enviando...' : 'Enviar candidatura'}
      </button>
    </form>
  )
}
