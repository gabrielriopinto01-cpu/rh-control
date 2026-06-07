'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Mail, Phone, MapPin, Banknote, Calendar, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatCPF, getInitials } from '@/lib/utils'
import type { Employee, Department, Position } from '@/types/database'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active:     { label: 'Ativo',     variant: 'default' },
  inactive:   { label: 'Inativo',   variant: 'secondary' },
  on_leave:   { label: 'Afastado',  variant: 'outline' },
  terminated: { label: 'Desligado', variant: 'destructive' },
}

const CONTRACT_MAP: Record<string, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estágio', temporario: 'Temporário',
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [employee, setEmployee]     = useState<Employee | null>(null)
  const [department, setDepartment] = useState<Department | null>(null)
  const [position, setPosition]     = useState<Position | null>(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured() || !id) { setLoading(false); return }
    const supabase = createClient()
    const load = async () => {
      const { data } = await supabase.from('employees').select('*').eq('id', id).single()
      setEmployee(data)
      if (data?.department_id) {
        const { data: dept } = await supabase.from('departments').select('*').eq('id', data.department_id).single()
        setDepartment(dept)
      }
      if (data?.position_id) {
        const { data: pos } = await supabase.from('positions').select('*').eq('id', data.position_id).single()
        setPosition(pos)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Colaborador não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/employees')}>
          Voltar
        </Button>
      </div>
    )
  }

  const status = STATUS_MAP[employee.status]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/employees')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Colaboradores
        </Button>
        <Button size="sm" onClick={() => router.push(`/employees?edit=${employee.id}`)}>
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </Button>
      </div>

      {/* Perfil */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-5">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-xl font-bold">
                {getInitials(employee.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">{employee.full_name}</h2>
                <Badge variant={status.variant}>{status.label}</Badge>
                <Badge variant="outline">{CONTRACT_MAP[employee.contract_type]}</Badge>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {position?.title ?? '—'} {department ? `· ${department.name}` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-1">Cód. {employee.employee_code}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Salário</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(employee.salary)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dados pessoais */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={<Briefcase className="h-4 w-4" />} label="CPF" value={formatCPF(employee.cpf)} />
            {employee.rg && <Row icon={<Briefcase className="h-4 w-4" />} label="RG" value={employee.rg} />}
            {employee.birth_date && (
              <Row icon={<Calendar className="h-4 w-4" />} label="Nascimento" value={formatDate(employee.birth_date)} />
            )}
          </CardContent>
        </Card>

        {/* Vínculo */}
        <Card>
          <CardHeader><CardTitle className="text-base">Vínculo empregatício</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={<Calendar className="h-4 w-4" />} label="Admissão" value={formatDate(employee.hire_date)} />
            {employee.termination_date && (
              <Row icon={<Calendar className="h-4 w-4" />} label="Demissão" value={formatDate(employee.termination_date)} />
            )}
            <Row icon={<Briefcase className="h-4 w-4" />} label="Contrato" value={CONTRACT_MAP[employee.contract_type]} />
          </CardContent>
        </Card>

        {/* Endereço */}
        {employee.address && (
          <Card>
            <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm text-gray-600">
              <p>{employee.address.street}, {employee.address.number} {employee.address.complement ?? ''}</p>
              <p>{employee.address.neighborhood} — {employee.address.city}/{employee.address.state}</p>
              <p>CEP: {employee.address.cep}</p>
            </CardContent>
          </Card>
        )}

        {/* Banco */}
        {employee.bank_details && (
          <Card>
            <CardHeader><CardTitle className="text-base">Dados bancários</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={<Banknote className="h-4 w-4" />} label="Banco" value={employee.bank_details.bank} />
              <Row icon={<Banknote className="h-4 w-4" />} label="Agência / Conta"
                value={`${employee.bank_details.agency} / ${employee.bank_details.account}`} />
              {employee.bank_details.pix_key && (
                <Row icon={<Banknote className="h-4 w-4" />} label="PIX" value={employee.bank_details.pix_key} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400">{icon}</span>
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  )
}
