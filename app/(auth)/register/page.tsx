'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const registerSchema = z.object({
  company_name: z.string().min(2, 'Nome da empresa obrigatório'),
  full_name: z.string().min(2, 'Nome completo obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Senhas não conferem',
  path: ['confirm_password'],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterForm) => {
    if (!isSupabaseConfigured()) {
      toast.error('Configure o Supabase no .env.local para continuar.')
      return
    }

    const supabase = createClient()

    const slug = data.company_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // 1. Criar conta no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })

    if (authError || !authData.user) {
      toast.error(authError?.message ?? 'Erro ao criar conta')
      return
    }

    // 2. Criar empresa
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({ name: data.company_name, slug, plan: 'free', status: 'active' })
      .select()
      .single()

    if (companyError) {
      toast.error('Erro ao criar empresa')
      return
    }

    // 3. Criar perfil do admin
    await supabase.from('profiles').insert({
      id: authData.user.id,
      company_id: company.id,
      full_name: data.full_name,
      email: data.email,
      role: 'adm_total',
      is_active: true,
    })

    // Se o Supabase exigir confirmação de e-mail, o usuário não estará autenticado ainda
    if (authData.user.confirmed_at || authData.session) {
      toast.success('Empresa criada com sucesso!')
      router.push('/onboarding')
    } else {
      toast.success('Empresa criada! Verifique seu e-mail para ativar a conta.')
      router.push('/login?confirm=1')
    }
  }

  return (
    <Card className="shadow-2xl border-0">
      <CardHeader>
        <CardTitle className="text-xl text-center text-gray-800">Cadastrar empresa</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da empresa</Label>
            <Input placeholder="Empresa LTDA" {...register('company_name')} />
            {errors.company_name && (
              <p className="text-xs text-red-500">{errors.company_name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Seu nome completo</Label>
            <Input placeholder="João da Silva" {...register('full_name')} />
            {errors.full_name && (
              <p className="text-xs text-red-500">{errors.full_name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" placeholder="joao@empresa.com" {...register('email')} />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <Input type="password" placeholder="••••••••" {...register('password')} />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar senha</Label>
            <Input type="password" placeholder="••••••••" {...register('confirm_password')} />
            {errors.confirm_password && (
              <p className="text-xs text-red-500">{errors.confirm_password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar empresa
          </Button>
          <p className="text-sm text-gray-500 text-center">
            Já tem conta?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
