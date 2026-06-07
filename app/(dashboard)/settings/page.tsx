'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Building2, User, Lock, Loader2, CheckCircle2, UserPlus, Camera, Mail, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Company, Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  adm_total:   'ADM Total',
  rh:          'RH',
  gestor:      'Gestor',
  colaborador: 'Colaborador',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
}

export default function SettingsPage() {
  const { user } = useAuth()
  const logoRef   = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const [company,  setCompany]  = useState<Company | null>(null)
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [members,  setMembers]  = useState<Profile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)

  // Empresa
  const [companyForm, setCompanyForm] = useState({ name: '', cnpj: '' })
  const [logoUrl,     setLogoUrl]     = useState<string | null>(null)
  // Perfil
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' })
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null)
  // Senha
  const [pwForm, setPwForm] = useState({ next: '', confirm: '' })
  // Convite
  const [inviteDialog, setInviteDialog] = useState(false)
  const [inviteForm,   setInviteForm]   = useState({ email: '', full_name: '', role: 'colaborador', employee_id: '' })
  const [inviting,     setInviting]     = useState(false)
  const [unlinkedEmps, setUnlinkedEmps] = useState<Array<{ id: string; full_name: string; email: string | null }>>([])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [cRes, pRes, mRes] = await Promise.all([
      supabase.from('companies').select('*').eq('id', user.company_id).single(),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('profiles').select('*').eq('company_id', user.company_id).order('full_name'),
    ])
    if (cRes.data) {
      setCompany(cRes.data)
      setCompanyForm({ name: cRes.data.name, cnpj: cRes.data.cnpj ?? '' })
      setLogoUrl(cRes.data.logo_url)
    }
    if (pRes.data) {
      setProfile(pRes.data)
      setProfileForm({ full_name: pRes.data.full_name, email: pRes.data.email })
      setAvatarUrl(pRes.data.avatar_url)
    }
    setMembers(mRes.data ?? [])
    // Busca funcionários sem profile vinculado
    const { data: emps } = await supabase
      .from('employees')
      .select('id, full_name, email')
      .eq('company_id', user.company_id)
      .eq('status', 'active')
      .is('profile_id', null)
      .order('full_name')
    setUnlinkedEmps(emps ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Upload logo da empresa
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user || !isSupabaseConfigured()) return
    const ext  = file.name.split('.').pop()
    const path = `${user.company_id}/logo.${ext}`
    const supabase = createClient()
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { toast.error('Erro no upload. Verifique o bucket "documents".'); return }
    const { data } = supabase.storage.from('documents').getPublicUrl(path)
    setLogoUrl(data.publicUrl)
    await supabase.from('companies').update({ logo_url: data.publicUrl }).eq('id', user.company_id)
    toast.success('Logo atualizada!')
  }

  // Upload avatar do perfil
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user || !isSupabaseConfigured()) return
    const ext  = file.name.split('.').pop()
    const path = `${user.company_id}/avatars/profile_${user.id}.${ext}`
    const supabase = createClient()
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { toast.error('Erro no upload.'); return }
    const { data } = supabase.storage.from('documents').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
    toast.success('Foto atualizada!')
  }

  const saveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !company) return
    setSaving('company')
    const supabase = createClient()
    const { error } = await supabase.from('companies').update({
      name: companyForm.name, cnpj: companyForm.cnpj || null,
    }).eq('id', company.id)
    setSaving(null)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success('Empresa atualizada!')
    load()
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !profile) return
    setSaving('profile')
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name,
    }).eq('id', profile.id)
    setSaving(null)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success('Perfil atualizado!')
    load()
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured()) return
    if (pwForm.next !== pwForm.confirm) { toast.error('Senhas não conferem'); return }
    if (pwForm.next.length < 6) { toast.error('Senha mínimo 6 caracteres'); return }
    setSaving('password')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    setSaving(null)
    if (error) { toast.error(error.message); return }
    toast.success('Senha alterada!')
    setPwForm({ next: '', confirm: '' })
  }

  const updateMemberRole = async (memberId: string, role: string) => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ role: role as Profile['role'] }).eq('id', memberId)
    if (error) { toast.error('Erro ao atualizar'); return }
    toast.success('Papel atualizado!')
    load()
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Remover este membro do sistema?')) return
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { error } = await supabase.auth.admin.deleteUser(memberId)
    if (error) {
      // Fallback: só desativa o perfil
      await supabase.from('profiles').update({ is_active: false }).eq('id', memberId)
    }
    toast.success('Membro removido!')
    load()
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!inviteForm.email || !inviteForm.full_name) {
      toast.error('Preencha e-mail e nome'); return
    }
    setInviting(true)
    const supabase = createClient()

    // Usa signUp para criar o usuário convidado com senha temporária
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    inviteForm.email,
      password: tempPassword,
      options:  {
        data: {
          company_id: user.company_id,
          full_name:  inviteForm.full_name,
          role:       inviteForm.role,
        },
      },
    })

    if (authError || !authData.user) {
      toast.error(authError?.message ?? 'Erro ao convidar')
      setInviting(false)
      return
    }

    // Cria o profile manualmente (caso o trigger não rode ainda)
    await supabase.from('profiles').upsert({
      id:          authData.user.id,
      company_id:  user.company_id,
      full_name:   inviteForm.full_name,
      email:       inviteForm.email,
      role:        inviteForm.role,
      employee_id: inviteForm.employee_id || null,
      is_active:   true,
    }, { onConflict: 'id' })

    // Vincula profile_id ao registro de funcionário selecionado
    if (inviteForm.employee_id) {
      await supabase
        .from('employees')
        .update({ profile_id: authData.user.id })
        .eq('id', inviteForm.employee_id)
    }

    setInviting(false)
    setInviteDialog(false)
    setInviteForm({ email: '', full_name: '', role: 'colaborador', employee_id: '' })
    toast.success(`Convite enviado para ${inviteForm.email}! Senha temporária: ${tempPassword}`, {
      duration: 10000,
      description: 'Anote a senha — o usuário deve alterá-la no primeiro acesso.',
    })
    load()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500 mt-1">Configurações da empresa e do perfil</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 mt-1">Configurações da empresa e do perfil</p>
      </div>

      {/* Empresa */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-800">Dados da empresa</h2>
        </div>
        <Separator />

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-xl bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                : <Building2 className="h-7 w-7 text-gray-400" />
              }
            </div>
            <button
              type="button"
              onClick={() => logoRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700"
            >
              <Camera className="h-3 w-3 text-white" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Logo da empresa</p>
            <p className="text-xs text-gray-400">JPG, PNG · máx. 2 MB</p>
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
        <Separator />

        {company && (
          <div className="flex items-center gap-6 p-3 rounded-lg bg-gray-50">
            <div>
              <p className="text-xs text-gray-500">Plano</p>
              <p className="font-semibold text-gray-800">{PLAN_LABELS[company.plan] ?? company.plan}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className={`font-semibold ${company.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                {company.status === 'active' ? 'Ativa' : 'Inativa'}
              </p>
            </div>
          </div>
        )}
        <form onSubmit={saveCompany} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Nome da empresa *</Label>
              <Input value={companyForm.name} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input placeholder="00.000.000/0000-00" value={companyForm.cnpj}
                onChange={e => setCompanyForm(f => ({ ...f, cnpj: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving === 'company'}>
              {saving === 'company' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar empresa
            </Button>
          </div>
        </form>
      </section>

      {/* Perfil */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-800">Meu perfil</h2>
        </div>
        <Separator />

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center">
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                : <User className="h-7 w-7 text-gray-400" />
              }
            </div>
            <button
              type="button"
              onClick={() => avatarRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-6 w-6 bg-purple-600 rounded-full flex items-center justify-center hover:bg-purple-700"
            >
              <Camera className="h-3 w-3 text-white" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Foto do perfil</p>
            <p className="text-xs text-gray-400">JPG, PNG · máx. 2 MB</p>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <Separator />

        {profile && (
          <div className="flex items-center gap-6 p-3 rounded-lg bg-gray-50">
            <div>
              <p className="text-xs text-gray-500">Papel</p>
              <p className="font-semibold text-gray-800">{ROLE_LABELS[profile.role]}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">E-mail</p>
              <p className="font-semibold text-gray-800">{profile.email}</p>
            </div>
          </div>
        )}
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input value={profileForm.full_name}
              onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving === 'profile'}>
              {saving === 'profile' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar perfil
            </Button>
          </div>
        </form>
      </section>

      {/* Senha */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-gray-600" />
          <h2 className="text-base font-semibold text-gray-800">Alterar senha</h2>
        </div>
        <Separator />
        <form onSubmit={savePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nova senha *</Label>
            <Input type="password" placeholder="Mínimo 6 caracteres" value={pwForm.next}
              onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar nova senha *</Label>
            <Input type="password" placeholder="Repita a senha" value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
            {pwForm.confirm && pwForm.next !== pwForm.confirm && (
              <p className="text-xs text-red-500">Senhas não conferem</p>
            )}
            {pwForm.confirm && pwForm.next === pwForm.confirm && pwForm.next.length >= 6 && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Senhas conferem
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving === 'password'}>
              {saving === 'password' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar senha
            </Button>
          </div>
        </form>
      </section>

      {/* Membros da equipe */}
      {(user?.role === 'adm_total' || user?.role === 'rh') && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-800">Membros da equipe</h2>
            <span className="ml-auto text-xs text-gray-400">{members.length} usuário{members.length !== 1 ? 's' : ''}</span>
            <Button size="sm" variant="outline" onClick={() => setInviteDialog(true)} className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Convidar
            </Button>
          </div>
          <Separator />
          <div className="space-y-3">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{m.full_name}</p>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.id === user?.id ? (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{ROLE_LABELS[m.role]}</span>
                  ) : (
                    <>
                      <Select defaultValue={m.role} onValueChange={(v) => v && updateMemberRole(m.id, v)}>
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([v, label]) => (
                            <SelectItem key={v} value={v}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {user?.role === 'adm_total' && (
                        <button
                          onClick={() => removeMember(m.id)}
                          className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-400"
                        >
                          Remover
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dialog convite */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Convidar membro
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input placeholder="João da Silva"
                value={inviteForm.full_name}
                onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" placeholder="joao@empresa.com"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Papel *</Label>
              <Select defaultValue={inviteForm.role} onValueChange={(v) => v && setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteForm.role === 'colaborador' && unlinkedEmps.length > 0 && (
              <div className="space-y-1.5">
                <Label>Vincular ao funcionário</Label>
                <Select
                  defaultValue={inviteForm.employee_id || 'none'}
                  onValueChange={(v) => setInviteForm(f => ({ ...f, employee_id: v === 'none' ? '' : (v ?? '') }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar funcionário (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não vincular agora</SelectItem>
                    {unlinkedEmps.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}{e.email ? ` — ${e.email}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">Vincula o login ao cadastro de funcionário para acesso ao Meu Ponto, Holerites etc.</p>
              </div>
            )}
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
              Uma senha temporária será gerada. Compartilhe com o colaborador para o primeiro acesso — ele poderá alterá-la nas configurações.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setInviteDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar acesso
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
