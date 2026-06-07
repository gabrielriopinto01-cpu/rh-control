'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const needsConfirm = searchParams.get('confirm') === '1'
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    if (!isSupabaseConfigured()) {
      toast.error('Configure o Supabase no .env.local para continuar.')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      toast.error('E-mail ou senha incorretos')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      {!isSupabaseConfigured() && (
        <div className="mb-4 rounded-lg bg-yellow-400/20 border border-yellow-400/40 px-4 py-3 text-sm text-yellow-200">
          <strong>Atenção:</strong> Supabase não configurado. Preencha o{' '}
          <code className="font-mono text-xs bg-yellow-400/20 px-1 rounded">.env.local</code>{' '}
          com suas credenciais para usar o sistema.
        </div>
      )}
      {needsConfirm && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          <strong>Verifique seu e-mail!</strong> Enviamos um link de confirmação. Após confirmar, faça login abaixo.
        </div>
      )}
      <Card className="shadow-2xl border-0">
        <CardHeader>
          <CardTitle className="text-xl text-center text-gray-800">Entrar na sua conta</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@empresa.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Entrar
            </Button>
            <p className="text-sm text-gray-500 text-center">
              Não tem conta?{' '}
              <Link href="/register" className="text-blue-600 hover:underline font-medium">
                Cadastre sua empresa
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </>
  )
}
