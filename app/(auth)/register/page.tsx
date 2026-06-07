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

    // 1. Cria empresa + usuario via API server-side (confirma email automaticamente)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:        data.email,
        password:     data.password,
        full_name:    data.full_name,
        company_name: data.company_name,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erro ao criar conta')
      return
    }

    // 2. Faz login com as credenciais recém-criadas
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    data.email,
      password: data.password,
    })

    if (signInError) {
      toast.error('Conta criada! Faça login para continuar.')
      router.push('/login')
      return
    }

    toast.success('Empresa criada com sucesso!')
    router.push('/login?cadastro=ok')
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
