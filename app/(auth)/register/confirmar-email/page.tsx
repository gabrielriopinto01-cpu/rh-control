'use client'

import { useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ConfirmarEmailPage() {
  const params = useSearchParams()
  const email  = params.get('email') ?? 'seu e-mail'

  return (
    <Card className="shadow-2xl border-0">
      <CardHeader>
        <CardTitle className="text-xl text-center text-gray-800">Confirme seu e-mail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-center">
        <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>
        <div className="space-y-2">
          <p className="text-gray-700 font-medium">Empresa criada com sucesso!</p>
          <p className="text-gray-500 text-sm">
            Enviamos um link de confirmacao para:
          </p>
          <p className="font-semibold text-gray-900 text-sm break-all">{email}</p>
          <p className="text-gray-500 text-sm">
            Clique no link do e-mail para ativar sua conta e acessar o sistema.
          </p>
        </div>
        <div className="pt-2 space-y-2">
          <Link href="/login">
            <Button className="w-full">Ir para o login</Button>
          </Link>
          <p className="text-xs text-gray-400">
            Nao recebeu? Verifique a pasta de spam.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}