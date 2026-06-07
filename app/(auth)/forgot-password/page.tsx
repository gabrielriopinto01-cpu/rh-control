'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2, ArrowLeft } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})

type ForgotPasswordForm = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: ForgotPasswordForm) => {
    if (!isSupabaseConfigured()) {
      toast.error('Configure o Supabase no .env.local para continuar.')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })

    if (error) {
      toast.error('Erro ao enviar e-mail. Tente novamente.')
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <Card className="shadow-2xl border-0">
        <CardContent className="pt-8 pb-6 text-center space-y-3">
          <p className="text-2xl">📧</p>
          <h2 className="text-lg font-semibold text-gray-800">E-mail enviado!</h2>
          <p className="text-sm text-gray-500">
            Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
          </p>
          <Link href="/login" className="text-sm text-blue-600 hover:underline block mt-4">
            Voltar ao login
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-2xl border-0">
      <CardHeader>
        <CardTitle className="text-xl text-center text-gray-800">Recuperar senha</CardTitle>
        <p className="text-sm text-gray-500 text-center mt-1">
          Informe seu e-mail e enviaremos um link de redefinição.
        </p>
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
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar link de recuperação
          </Button>
          <Link
            href="/login"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao login
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
