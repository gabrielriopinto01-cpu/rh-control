'use client'

import { useState, useRef } from 'react'
import { User, Camera, Phone, Mail, MapPin, Building2, Briefcase, Calendar, CreditCard, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const CONTRACT_LABELS: Record<string, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estágio', temporario: 'Temporário',
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default function MeuPerfilPage() {
  const { user }                            = useAuth()
  const { employee, loading }               = useMyEmployee()
  const [phone,     setPhone]               = useState('')
  const [saving,    setSaving]              = useState(false)
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null)
  const [uploading, setUploading]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Troca de senha
  const [pwForm,    setPwForm]    = useState({ current: '', next: '', confirm: '' })
  const [pwSaving,  setPwSaving]  = useState(false)
  const [showPw,    setShowPw]    = useState({ current: false, next: false, confirm: false })

  // Inicializa estado com dados do employee quando carregado
  const displayPhone    = phone    || employee?.phone    || ''
  const displayAvatar   = avatarUrl ?? employee?.avatar_url ?? user?.avatar_url ?? null

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isSupabaseConfigured() || !user) return
    const ext  = file.name.split('.').pop()
    const path = `${user.company_id}/avatars/profile_${user.id}.${ext}`
    setUploading(true)
    const supabase = createClient()
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { toast.error('Erro ao enviar foto'); setUploading(false); return }
    const { data } = supabase.storage.from('documents').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    setUploading(false)
    toast.success('Foto atualizada!')
  }

  const handleSave = async () => {
    if (!isSupabaseConfigured() || !user || !employee) return
    setSaving(true)
    const supabase = createClient()
    const updates: Record<string, string | null> = {}
    if (phone)     updates.phone     = phone
    if (avatarUrl) updates.avatar_url = avatarUrl

    if (Object.keys(updates).length === 0) { toast.info('Nenhuma alteração'); setSaving(false); return }

    const { error } = await supabase.from('employees').update(updates).eq('id', employee.id)
    if (error) { toast.error('Erro ao salvar'); setSaving(false); return }

    // Atualiza avatar no profile também
    if (avatarUrl) {
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
    }

    setSaving(false)
    toast.success('Perfil atualizado!')
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured()) return
    if (pwForm.next.length < 6)             { toast.error('Senha mínimo 6 caracteres'); return }
    if (pwForm.next !== pwForm.confirm)      { toast.error('As senhas não conferem'); return }
    setPwSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    setPwSaving(false)
    if (error) { toast.error(error.message); return }
    setPwForm({ current: '', next: '', confirm: '' })
    toast.success('Senha alterada com sucesso!')
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  if (!employee) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Perfil de funcionário não encontrado</p>
      <p className="text-sm text-gray-400 mt-1">Peça ao RH para vincular seu usuário ao cadastro de colaborador.</p>
    </div>
  )

  const addr = employee.address

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 mt-1">Suas informações pessoais e funcionais</p>
      </div>

      {/* Avatar + nome */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-6">
        <div className="relative">
          <Avatar className="h-20 w-20">
            {displayAvatar && <AvatarImage src={displayAvatar} alt={employee.full_name} />}
            <AvatarFallback className="text-2xl bg-blue-100 text-blue-700">{getInitials(employee.full_name)}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 h-7 w-7 bg-blue-600 rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors"
          >
            {uploading ? <span className="animate-spin text-white text-xs">⟳</span> : <Camera className="h-3.5 w-3.5 text-white" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{employee.full_name}</h2>
          <p className="text-gray-500 text-sm">{user?.email}</p>
          <p className="text-xs text-blue-600 font-medium mt-1 uppercase tracking-wide">
            {CONTRACT_LABELS[employee.contract_type] ?? employee.contract_type}
          </p>
        </div>
      </div>

      {/* Dados funcionais (somente leitura) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-gray-400" /> Dados funcionais
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow icon={<CreditCard className="h-4 w-4" />}  label="Matrícula"    value={employee.employee_code} />
          <InfoRow icon={<Calendar className="h-4 w-4" />}    label="Admissão"     value={formatDate(employee.hire_date)} />
          <InfoRow icon={<Building2 className="h-4 w-4" />}   label="Departamento" value={employee.department_id ?? '—'} />
          <InfoRow icon={<Briefcase className="h-4 w-4" />}   label="CPF"          value={employee.cpf} />
        </div>
      </div>

      {/* Dados editáveis */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" /> Contato
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Mail className="h-3.5 w-3.5" /> E-mail
            </Label>
            <Input value={user?.email ?? ''} disabled className="bg-gray-50 text-gray-500" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <Phone className="h-3.5 w-3.5" /> Telefone
            </Label>
            <Input
              placeholder={employee.phone ?? 'Não informado'}
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Endereço (somente leitura) */}
      {addr && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" /> Endereço
          </h3>
          <p className="text-sm text-gray-600">
            {addr.street}, {addr.number}{addr.complement ? ` — ${addr.complement}` : ''}<br />
            {addr.neighborhood} — {addr.city}/{addr.state} — CEP {addr.cep}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <span className="mr-2 animate-spin">⟳</span>}
          Salvar alterações
        </Button>
      </div>

      {/* Troca de senha */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-400" /> Alterar senha
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {(['next', 'confirm'] as const).map((field) => {
            const labels = { next: 'Nova senha', confirm: 'Confirmar nova senha' }
            return (
              <div key={field} className="space-y-1.5">
                <Label>{labels[field]}</Label>
                <div className="relative">
                  <Input
                    type={showPw[field] ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pwForm[field]}
                    onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => ({ ...s, [field]: !s[field] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )
          })}
          {pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm && (
            <p className="text-xs text-red-500">As senhas não conferem</p>
          )}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="outline"
              disabled={pwSaving || !pwForm.next || !pwForm.confirm}
            >
              {pwSaving && <span className="mr-2 animate-spin">⟳</span>}
              Alterar senha
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="font-medium text-gray-800">{value}</p>
      </div>
    </div>
  )
}
