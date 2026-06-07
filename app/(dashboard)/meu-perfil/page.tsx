'use client'

import { useState, useEffect, useCallback } from 'react'
import { User, KeyRound, Camera, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/lib/store/auth-store'

export const dynamic = 'force-dynamic'

type EmployeeInfo = {
  full_name:  string
  position:   string | null
  email:      string | null
  phone:      string | null
  cpf:        string | null
  hire_date:  string | null
  department: { name: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  adm_total:   'Administrador',
  rh:          'RH',
  gestor:      'Gestor',
  colaborador: 'Colaborador',
}

export default function MeuPerfilPage() {
  const { user }    = useAuth()
  const { setUser } = useAuthStore()

  const [empInfo,      setEmpInfo]      = useState<EmployeeInfo | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [senha,        setSenha]        = useState({ nova: '', confirmar: '' })
  const [showSenha,    setShowSenha]    = useState({ nova: false, confirmar: false })
  const [savingPwd,    setSavingPwd]    = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.employee_id) { setLoading(false); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('employees')
      .select('full_name, position, email, phone, cpf, hire_date, department:departments(name)')
      .eq('id', user.employee_id)
      .single()
    if (data) setEmpInfo(data as unknown as EmployeeInfo)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (senha.nova.length < 6) { toast.error('A nova senha deve ter no mínimo 6 caracteres'); return }
    if (senha.nova !== senha.confirmar) { toast.error('As senhas não conferem'); return }
    setSavingPwd(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha.nova })
    if (error) {
      toast.error('Erro ao alterar senha. Tente fazer logout e login novamente.')
    } else {
      toast.success('Senha alterada com sucesso!')
      setSenha({ nova: '', confirmar: '' })
    }
    setSavingPwd(false)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 2 MB'); return }

    // Valida MIME type real lendo os primeiros bytes (magic bytes)
    const validMime = await new Promise<boolean>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const arr = new Uint8Array(reader.result as ArrayBuffer).subarray(0, 4)
        const header = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
        const isJpeg = header.startsWith('ffd8ff')
        const isPng  = header === '89504e47'
        const isWebp = header.startsWith('52494646') // RIFF
        resolve(isJpeg || isPng || isWebp)
      }
      reader.readAsArrayBuffer(file.slice(0, 4))
    })
    if (!validMime) { toast.error('Formato inválido. Use JPG, PNG ou WEBP.'); return }

    setSavingAvatar(true)
    const supabase = createClient()
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.company_id}/${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { toast.error('Erro ao enviar imagem. Tente novamente.'); setSavingAvatar(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
    setUser({ ...user, avatar_url: data.publicUrl })
    toast.success('Foto atualizada!')
    setSavingAvatar(false)
  }

  const toggleShow = (field: 'nova' | 'confirmar') =>
    setShowSenha(s => ({ ...s, [field]: !s[field] }))

  const initials = user?.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? 'EU'

  const passwordStrength = [
    senha.nova.length >= 6,
    /[A-Z]/.test(senha.nova),
    /[0-9]/.test(senha.nova),
    /[^A-Za-z0-9]/.test(senha.nova),
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500 mt-1">Suas informações e configurações de acesso</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-5">
          <div className="relative flex-shrink-0">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center overflow-hidden">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                : <span className="text-2xl font-bold text-white">{initials}</span>
              }
            </div>
            <label
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 shadow-sm"
              title="Trocar foto"
            >
              {savingAvatar
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
                : <Camera className="h-3.5 w-3.5 text-gray-500" />
              }
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{user?.full_name}</h2>
              <Badge variant="secondary">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</Badge>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">{user?.email}</p>
            {empInfo?.position && (
              <p className="text-gray-600 text-sm mt-1 font-medium">{empInfo.position}</p>
            )}
          </div>
        </div>

        {empInfo && (
          <>
            <Separator className="my-5" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Departamento', value: (empInfo.department as { name: string } | null)?.name ?? '-' },
                { label: 'CPF',         value: empInfo.cpf ?? '-' },
                { label: 'Telefone',    value: empInfo.phone ?? '-' },
                { label: 'Admissão',    value: empInfo.hire_date ? new Date(empInfo.hire_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-gray-800 font-medium">{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <KeyRound className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Alterar senha</h3>
            <p className="text-xs text-gray-400">Mínimo de 6 caracteres</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nova senha *</Label>
            <div className="relative">
              <Input
                type={showSenha.nova ? 'text' : 'password'}
                placeholder="Digite a nova senha"
                value={senha.nova}
                onChange={e => setSenha(s => ({ ...s, nova: e.target.value }))}
                className="pr-10"
              />
              <button type="button" onClick={() => toggleShow('nova')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showSenha.nova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {senha.nova && (
              <div className="flex gap-1 mt-1">
                {passwordStrength.map((ok, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${ok ? 'bg-green-400' : 'bg-gray-200'}`} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Confirmar nova senha *</Label>
            <div className="relative">
              <Input
                type={showSenha.confirmar ? 'text' : 'password'}
                placeholder="Repita a nova senha"
                value={senha.confirmar}
                onChange={e => setSenha(s => ({ ...s, confirmar: e.target.value }))}
                className="pr-10"
              />
              <button type="button" onClick={() => toggleShow('confirmar')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showSenha.confirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {senha.confirmar && senha.nova !== senha.confirmar && (
              <p className="text-xs text-red-500">As senhas não conferem</p>
            )}
            {senha.confirmar && senha.nova === senha.confirmar && senha.nova.length >= 6 && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Senhas conferem
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={savingPwd || senha.nova.length < 6 || senha.nova !== senha.confirmar}
          >
            {savingPwd && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Alterar senha
          </Button>
        </form>
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
        <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>Para alterar dados pessoais (nome, CPF, telefone), entre em contato com o departamento de RH.</p>
      </div>
    </div>
  )
}