'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Building2, User, Lock, Loader2, CheckCircle2, UserPlus, Camera, Mail, Users, CreditCard, Zap, ArrowRight, Palette, MapPin, MessageCircle, RefreshCw, BellRing, Pencil, X, Check, ScrollText, ChevronDown } from 'lucide-react'
import { PLANS } from '@/lib/stripe/config'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useBrandingStore } from '@/lib/store/branding-store'
import { resolveBranding, applyBrandingVars, DEFAULT_BRANDING } from '@/lib/branding'
import type { Company, Profile, Branding } from '@/types/database'

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
  // White Label
  const setStoreBranding = useBrandingStore((s) => s.setBranding)
  const [brandForm, setBrandForm] = useState<Required<Branding>>(DEFAULT_BRANDING)
  // Ponto eletrônico
  const [attConfig, setAttConfig] = useState({
    geofence_enabled: false, lat: '', lng: '', radius_m: '200', require_selfie: false,
  })
  // WhatsApp
  const [waState,  setWaState]  = useState<{ connected: boolean; state: string | null; qr: string | null }>({ connected: false, state: null, qr: null })
  const [waBusy,   setWaBusy]   = useState(false)
  // Assinatura (Asaas)
  const [asaasPlan,    setAsaasPlan]    = useState('professional')
  const [asaasDoc,     setAsaasDoc]     = useState('')
  const [asaasBilling, setAsaasBilling] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX')
  const [asaasBusy,    setAsaasBusy]    = useState(false)
  // Perfil
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' })
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null)
  // Senha
  const [pwForm, setPwForm] = useState({ next: '', confirm: '' })
  // Automações
  type AutoRule = { id: string; event: string; template: string; send_to: string; active: boolean; _stats24h?: { sent: number; failed: number } }
  type AutoLog  = { id: string; event: string; recipient_name: string | null; recipient_phone: string | null; message: string | null; status: string; error: string | null; created_at: string }
  const [autoRules,    setAutoRules]    = useState<AutoRule[]>([])
  const [autoLoading,  setAutoLoading]  = useState(false)
  const [editRule,     setEditRule]     = useState<AutoRule | null>(null)
  const [editTemplate, setEditTemplate] = useState('')
  const [autoLogs,     setAutoLogs]     = useState<AutoLog[]>([])
  const [logsOpen,     setLogsOpen]     = useState(false)
  const [logsLoading,  setLogsLoading]  = useState(false)

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
      setBrandForm(resolveBranding(cRes.data.branding))
      const ac = (cRes.data.attendance_config ?? {}) as Record<string, unknown>
      setAttConfig({
        geofence_enabled: !!ac.geofence_enabled,
        lat: ac.lat != null ? String(ac.lat) : '',
        lng: ac.lng != null ? String(ac.lng) : '',
        radius_m: ac.radius_m != null ? String(ac.radius_m) : '200',
        require_selfie: !!ac.require_selfie,
      })
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

  // Status do WhatsApp ao abrir
  useEffect(() => {
    if (user?.role !== 'adm_total' && user?.role !== 'rh') return
    fetch('/api/whatsapp/connect').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setWaState(s => ({ ...s, connected: !!d.connected, state: d.state ?? null }))
    }).catch(() => {})
  }, [user])

  const connectWhatsapp = async () => {
    setWaBusy(true)
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Erro ao conectar'); return }
      setWaState({ connected: !!json.connected, state: json.state ?? null, qr: json.qr ?? null })
      if (json.connected) toast.success('WhatsApp já está conectado!')
    } catch { toast.error('Erro ao conectar WhatsApp') }
    finally { setWaBusy(false) }
  }

  const subscribeAsaas = async () => {
    if (!asaasDoc.trim()) { toast.error('Informe o CPF ou CNPJ'); return }
    setAsaasBusy(true)
    try {
      const res = await fetch('/api/asaas/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: asaasPlan, cpfCnpj: asaasDoc, billingType: asaasBilling }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Erro ao assinar'); return }
      if (json.invoiceUrl) {
        toast.success('Assinatura criada! Abrindo o pagamento...')
        window.open(json.invoiceUrl, '_blank')
      } else {
        toast.success('Assinatura criada! Verifique seu e-mail para pagar.')
      }
    } catch { toast.error('Erro ao assinar') }
    finally { setAsaasBusy(false) }
  }

  const refreshWhatsapp = async () => {
    setWaBusy(true)
    try {
      const res = await fetch('/api/whatsapp/connect')
      const json = await res.json()
      setWaState(s => ({ ...s, connected: !!json.connected, state: json.state ?? null, qr: json.connected ? null : s.qr }))
      if (json.connected) toast.success('WhatsApp conectado! 🎉')
    } catch {}
    finally { setWaBusy(false) }
  }

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
    setStoreBranding(brandForm, data.publicUrl)
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

  const saveBranding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !company) return
    setSaving('branding')
    const supabase = createClient()
    const branding: Branding = {
      primary:     brandForm.primary,
      secondary:   brandForm.secondary,
      button:      brandForm.button,
      system_name: brandForm.system_name,
      tagline:     brandForm.tagline,
      footer:      brandForm.footer,
    }
    const { error } = await supabase.from('companies').update({ branding }).eq('id', company.id)
    setSaving(null)
    if (error) { toast.error('Erro ao salvar identidade visual'); return }
    // Aplica na hora
    const resolved = resolveBranding(branding)
    applyBrandingVars(resolved)
    setStoreBranding(resolved, logoUrl)
    toast.success('Identidade visual atualizada!')
  }

  const saveAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !company) return
    setSaving('attendance')
    const supabase = createClient()
    const attendance_config = {
      geofence_enabled: attConfig.geofence_enabled,
      lat: attConfig.lat ? Number(attConfig.lat) : null,
      lng: attConfig.lng ? Number(attConfig.lng) : null,
      radius_m: attConfig.radius_m ? Number(attConfig.radius_m) : 200,
      require_selfie: attConfig.require_selfie,
    }
    const { error } = await supabase.from('companies').update({ attendance_config }).eq('id', company.id)
    setSaving(null)
    if (error) { toast.error('Erro ao salvar configuração de ponto'); return }
    toast.success('Configuração de ponto salva!')
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocalização indisponível'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setAttConfig(c => ({ ...c, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }))
        toast.success('Localização atual capturada!')
      },
      () => toast.error('Não foi possível obter a localização'),
      { timeout: 8000 },
    )
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

  const resendPassword = async (memberEmail: string) => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(memberEmail, {
      redirectTo: `${window.location.origin}/forgot-password`,
    })
    if (error) { toast.error('Erro ao reenviar: ' + error.message); return }
    toast.success(`E-mail de redefinição enviado para ${memberEmail}`, { duration: 6000 })
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

    // Vincula profile_id: usa seleção manual ou auto-detecta por e-mail
    let empId = inviteForm.employee_id
    if (!empId) {
      const { data: empByEmail } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', user.company_id)
        .eq('email', inviteForm.email)
        .maybeSingle()
      if (empByEmail) empId = empByEmail.id
    }
    if (empId) {
      await supabase
        .from('employees')
        .update({ profile_id: authData.user.id })
        .eq('id', empId)
      await supabase
        .from('profiles')
        .update({ employee_id: empId })
        .eq('id', authData.user.id)
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

  const loadAutoRules = useCallback(async () => {
    if (!user || !['adm_total', 'rh'].includes(user.role)) return
    setAutoLoading(true)
    const res = await fetch('/api/automations/rules')
    if (res.ok) setAutoRules(await res.json())
    setAutoLoading(false)
  }, [user])

  useEffect(() => { loadAutoRules() }, [loadAutoRules])

  const toggleRule = async (rule: AutoRule) => {
    await fetch('/api/automations/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, active: !rule.active }),
    })
    loadAutoRules()
  }

  const saveTemplate = async () => {
    if (!editRule) return
    await fetch('/api/automations/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editRule.id, template: editTemplate }),
    })
    setEditRule(null)
    toast.success('Template salvo!')
    loadAutoRules()
  }

  const loadLogs = async () => {
    if (!user || !['adm_total', 'rh'].includes(user.role)) return
    setLogsLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false })
      .limit(50)
    setAutoLogs((data as AutoLog[]) ?? [])
    setLogsLoading(false)
  }

  const EVENT_LABELS: Record<string, string> = {
    vacation_approved:  'Férias aprovadas',
    vacation_rejected:  'Férias recusadas',
    approval_requested: 'Nova solicitação de aprovação',
    employee_admitted:  'Novo colaborador admitido',
    birthday:           'Aniversário',
    document_expiring:  'Documento vencendo',
    payroll_closed:     'Folha fechada',
    work_anniversary:   'Aniversário de empresa',
    vacation_starting:  'Férias iniciando amanhã',
    missing_punch:      'Ponto não registrado',
  }
  const SEND_TO_LABELS: Record<string, string> = {
    employee: 'Colaborador', manager: 'Gestor', rh: 'RH', all: 'Todos',
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

      {/* White Label — Identidade visual (somente adm_total) */}
      {user?.role === 'adm_total' && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-pink-600" />
            <h2 className="text-base font-semibold text-gray-800">Identidade visual (White Label)</h2>
          </div>
          <Separator />
          <p className="text-sm text-gray-500">
            Personalize o sistema com a marca da sua empresa. As mudanças aparecem para todos os usuários da empresa.
          </p>

          <form onSubmit={saveBranding} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome do sistema</Label>
                <Input value={brandForm.system_name}
                  onChange={e => setBrandForm(f => ({ ...f, system_name: e.target.value }))}
                  placeholder="RH Control" />
              </div>
              <div className="space-y-1.5">
                <Label>Slogan / Tagline</Label>
                <Input value={brandForm.tagline}
                  onChange={e => setBrandForm(f => ({ ...f, tagline: e.target.value }))}
                  placeholder="Gestão de pessoas" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {([
                { key: 'primary',   label: 'Cor principal' },
                { key: 'secondary', label: 'Cor secundária' },
                { key: 'button',    label: 'Cor dos botões' },
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandForm[key]}
                      onChange={e => setBrandForm(f => ({ ...f, [key]: e.target.value }))}
                      className="h-10 w-12 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <Input value={brandForm[key]}
                      onChange={e => setBrandForm(f => ({ ...f, [key]: e.target.value }))}
                      className="font-mono text-xs uppercase" />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Rodapé personalizado</Label>
              <Input value={brandForm.footer}
                onChange={e => setBrandForm(f => ({ ...f, footer: e.target.value }))}
                placeholder="© 2026 Minha Empresa Ltda" />
            </div>

            {/* Pré-visualização */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3"
                   style={{ background: `linear-gradient(135deg, ${brandForm.primary}, ${brandForm.secondary})` }}>
                {logoUrl
                  ? <img src={logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                  : <div className="h-8 w-8 rounded-md bg-white/20" />}
                <div>
                  <p className="text-white font-bold leading-none">{brandForm.system_name || 'RH Control'}</p>
                  <p className="text-white/70 text-xs mt-0.5">{brandForm.tagline}</p>
                </div>
              </div>
              <div className="p-4 bg-gray-50 flex items-center gap-3">
                <button type="button" className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                        style={{ backgroundColor: brandForm.button }}>
                  Botão de exemplo
                </button>
                <span className="text-sm font-medium" style={{ color: brandForm.primary }}>Link de exemplo</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <Button type="button" variant="ghost" size="sm"
                onClick={() => setBrandForm(DEFAULT_BRANDING)}>
                Restaurar padrão
              </Button>
              <Button type="submit" disabled={saving === 'branding'}>
                {saving === 'branding' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar identidade visual
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Ponto eletrônico (somente adm_total / rh) */}
      {(user?.role === 'adm_total' || user?.role === 'rh') && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-rose-600" />
            <h2 className="text-base font-semibold text-gray-800">Ponto eletrônico</h2>
          </div>
          <Separator />
          <form onSubmit={saveAttendance} className="space-y-5">
            {/* Selfie obrigatória */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                checked={attConfig.require_selfie}
                onChange={e => setAttConfig(c => ({ ...c, require_selfie: e.target.checked }))} />
              <div>
                <p className="text-sm font-medium text-gray-800">Exigir selfie ao bater ponto</p>
                <p className="text-xs text-gray-400">O colaborador tira uma foto a cada registro.</p>
              </div>
            </label>
            <Separator />
            {/* Cerca virtual */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                checked={attConfig.geofence_enabled}
                onChange={e => setAttConfig(c => ({ ...c, geofence_enabled: e.target.checked }))} />
              <div>
                <p className="text-sm font-medium text-gray-800">Ativar cerca virtual (geofence)</p>
                <p className="text-xs text-gray-400">Marca batidas feitas fora do raio permitido.</p>
              </div>
            </label>

            {attConfig.geofence_enabled && (
              <div className="space-y-4 pl-7">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Latitude</Label>
                    <Input placeholder="-23.5505" value={attConfig.lat}
                      onChange={e => setAttConfig(c => ({ ...c, lat: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Longitude</Label>
                    <Input placeholder="-46.6333" value={attConfig.lng}
                      onChange={e => setAttConfig(c => ({ ...c, lng: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Raio (metros)</Label>
                    <Input type="number" placeholder="200" value={attConfig.radius_m}
                      onChange={e => setAttConfig(c => ({ ...c, radius_m: e.target.value }))} />
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>
                  <MapPin className="h-4 w-4 mr-1.5" /> Usar minha localização atual
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving === 'attendance'}>
                {saving === 'attendance' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar configuração
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* WhatsApp (somente adm_total / rh) */}
      {(user?.role === 'adm_total' || user?.role === 'rh') && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-base font-semibold text-gray-800">WhatsApp</h2>
            {waState.connected && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </span>
            )}
          </div>
          <Separator />
          <p className="text-sm text-gray-500">
            Conecte o número de WhatsApp da sua empresa para enviar comunicados e avisos aos colaboradores.
            Cada empresa usa o próprio número.
          </p>

          {waState.connected ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-900">WhatsApp conectado</p>
                <p className="text-sm text-green-700">Já é possível enviar mensagens pelos comunicados.</p>
              </div>
            </div>
          ) : waState.qr ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-gray-600">Abra o WhatsApp no celular → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong> e escaneie:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={waState.qr.startsWith('data:') ? waState.qr : `data:image/png;base64,${waState.qr}`} alt="QR Code" className="h-56 w-56 border rounded-lg" />
              <Button variant="outline" size="sm" onClick={refreshWhatsapp} disabled={waBusy}>
                {waBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Já escaneei / Atualizar status
              </Button>
            </div>
          ) : (
            <Button onClick={connectWhatsapp} disabled={waBusy}>
              {waBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
              Conectar WhatsApp
            </Button>
          )}
        </section>
      )}

      {/* Automações de WhatsApp */}
      {(user?.role === 'adm_total' || user?.role === 'rh') && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-semibold text-gray-800">Automações WhatsApp</h2>
            {autoLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400 ml-auto" />}
          </div>
          <Separator />
          <p className="text-sm text-gray-500">
            Configure mensagens automáticas enviadas via WhatsApp nos eventos de RH. Use <code className="bg-gray-100 px-1 rounded text-xs">{`{{variavel}}`}</code> para valores dinâmicos.
          </p>

          {autoRules.length === 0 && !autoLoading && (
            <p className="text-sm text-gray-400 text-center py-4">Nenhuma regra encontrada. Elas são criadas automaticamente ao carregar.</p>
          )}

          <div className="space-y-3">
            {autoRules.map(rule => (
              <div key={rule.id} className={`rounded-lg border p-4 transition-colors ${rule.active ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800">{EVENT_LABELS[rule.event] ?? rule.event}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{SEND_TO_LABELS[rule.send_to] ?? rule.send_to}</span>
                      {rule._stats24h && (rule._stats24h.sent > 0 || rule._stats24h.failed > 0) && (
                        <span className="text-xs text-gray-400">{rule._stats24h.sent} enviadas · {rule._stats24h.failed} falhas (24h)</span>
                      )}
                    </div>
                    {editRule?.id === rule.id ? (
                      <div className="space-y-2 mt-2">
                        <textarea
                          rows={4}
                          value={editTemplate}
                          onChange={e => setEditTemplate(e.target.value)}
                          className="w-full text-xs border border-gray-300 rounded-lg p-2 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveTemplate}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditRule(null)}>
                            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-3 font-mono">{rule.template}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditRule(rule); setEditTemplate(rule.template) }}
                      className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                      title="Editar template"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleRule(rule)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.active ? 'bg-amber-400' : 'bg-gray-300'}`}
                      title={rule.active ? 'Desativar' : 'Ativar'}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule.active ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Disparar cron manualmente */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Verificar automações agora</p>
              <p className="text-xs text-gray-400">Roda diariamente às 08:00 (BRT). Clique para executar manualmente.</p>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              const res = await fetch('/api/automations/cron')
              const d = await res.json()
              if (d.ok) toast.success(`Cron executado: ${d.birthdaysFired} aniversários, ${d.vacationsFired} férias, ${d.missingPunchFired} pontos ausentes`)
              else toast.error('Erro ao executar')
            }}>
              Executar
            </Button>
          </div>

          {/* Histórico de envios */}
          <div className="border-t pt-4">
            <button
              onClick={() => { setLogsOpen(o => !o); if (!logsOpen) loadLogs() }}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ScrollText className="h-4 w-4" />
              Histórico de envios (últimos 50)
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${logsOpen ? 'rotate-180' : ''}`} />
            </button>
            {logsOpen && (
              <div className="mt-3 space-y-2">
                {logsLoading && <p className="text-xs text-gray-400">Carregando...</p>}
                {!logsLoading && autoLogs.length === 0 && (
                  <p className="text-xs text-gray-400">Nenhum envio registrado ainda.</p>
                )}
                {autoLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 text-xs p-2 rounded bg-gray-50 border">
                    <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${log.status === 'sent' ? 'bg-green-500' : log.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-700">{log.recipient_name ?? '—'}</span>
                        <span className="text-gray-400 shrink-0">{new Date(log.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                      </div>
                      <p className="text-gray-500 truncate">{EVENT_LABELS[log.event] ?? log.event}</p>
                      {log.error && <p className="text-red-400">{log.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

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
                      <button
                        onClick={() => resendPassword(m.email)}
                        className="text-xs px-2 py-1 rounded hover:bg-blue-50 text-blue-400"
                        title="Enviar e-mail de redefinição de senha"
                      >
                        Reenviar senha
                      </button>
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

      {/* ── Plano & Cobrança ───────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-800">Plano & Cobrança</h2>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold text-gray-900 capitalize">
                {(company as any)?.plan ?? 'Free'}
              </span>
              {(company as any)?.plan_status === 'active' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ativo</span>
              )}
              {(company as any)?.plan_status === 'past_due' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Pagamento pendente</span>
              )}
            </div>
            {(company as any)?.plan_expires_at && (
              <p className="text-sm text-gray-500">
                Renova em {new Date((company as any).plan_expires_at).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(company as any)?.stripe_subscription_id && (
              <Button variant="outline" size="sm" onClick={async () => {
                const res = await fetch('/api/stripe/portal', { method: 'POST' })
                const { url } = await res.json()
                if (url) window.location.href = url
              }}>
                <CreditCard className="h-4 w-4 mr-1.5" /> Gerenciar assinatura
              </Button>
            )}
            <Button size="sm" onClick={() => window.open('/pricing', '_blank')}>
              <Zap className="h-4 w-4 mr-1.5" />
              {!(company as any)?.plan || (company as any)?.plan === 'free' ? 'Fazer upgrade' : 'Ver planos'}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Assinar com PIX/Boleto/Cartão (Asaas) */}
        <Separator />
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Assinar com PIX, Boleto ou Cartão</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'starter',      label: 'Starter',      price: 'R$ 97' },
              { id: 'professional', label: 'Professional', price: 'R$ 197' },
              { id: 'enterprise',   label: 'Enterprise',   price: 'R$ 497' },
            ] as const).map(p => (
              <button key={p.id} type="button" onClick={() => setAsaasPlan(p.id)}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  asaasPlan === p.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-semibold text-gray-800">{p.label}</p>
                <p className="text-xs text-gray-500">{p.price}/mês</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CPF ou CNPJ</Label>
              <Input placeholder="Só números" value={asaasDoc} onChange={e => setAsaasDoc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={asaasBilling} onValueChange={(v) => setAsaasBilling((v ?? 'PIX') as 'PIX' | 'BOLETO' | 'CREDIT_CARD')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={subscribeAsaas} disabled={asaasBusy}>
              {asaasBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assinar agora
            </Button>
          </div>
        </div>
      </section>

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
