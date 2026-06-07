'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { employeeSchema, type EmployeeFormInput, type EmployeeFormData } from '@/lib/validations/employee'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Camera, User } from 'lucide-react'
import { nn } from '@/lib/utils'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import type { Department, Position } from '@/types/database'

interface EmployeeFormProps {
  defaultValues?: Partial<EmployeeFormInput>
  departments: Department[]
  positions: Position[]
  companyId?: string
  initialAvatarUrl?: string | null
  onSubmit: (data: EmployeeFormData, avatarUrl?: string | null) => Promise<void>
  onCancel: () => void
}

export function EmployeeForm({ defaultValues, departments, positions, companyId, initialAvatarUrl, onSubmit, onCancel }: EmployeeFormProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null)
  const [uploading, setUploading] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !companyId || !isSupabaseConfigured()) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${companyId}/avatars/${Date.now()}.${ext}`
    const supabase = createClient()
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) {
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('documents').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    setUploading(false)
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormInput, unknown, EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { contract_type: 'clt', status: 'active', account_type: 'corrente', ...defaultValues },
  })

  const selectedDept = watch('department_id')
  const filteredPositions = selectedDept
    ? positions.filter((p) => p.department_id === selectedDept)
    : positions

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data, avatarUrl))} className="space-y-6">
      <Tabs defaultValue="personal">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="personal">Pessoal</TabsTrigger>
          <TabsTrigger value="job">Profissional</TabsTrigger>
          <TabsTrigger value="bank">Banco & Endereço</TabsTrigger>
        </TabsList>

        {/* Aba Pessoal */}
        <TabsContent value="personal" className="space-y-4 pt-4">
          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  : <User className="h-8 w-8 text-gray-400" />
                }
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700"
              >
                {uploading ? <Loader2 className="h-3 w-3 text-white animate-spin" /> : <Camera className="h-3 w-3 text-white" />}
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Foto do colaborador</p>
              <p className="text-xs text-gray-400">JPG, PNG ou WEBP · máx. 2 MB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome completo *</Label>
              <Input placeholder="João da Silva" {...register('full_name')} />
              {errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>CPF *</Label>
              <Input placeholder="000.000.000-00" {...register('cpf')} />
              {errors.cpf && <p className="text-xs text-red-500">{errors.cpf.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>RG</Label>
              <Input placeholder="00.000.000-0" {...register('rg')} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" {...register('birth_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" placeholder="joao@empresa.com" {...register('email')} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input placeholder="(11) 99999-9999" {...register('phone')} />
            </div>
          </div>
        </TabsContent>

        {/* Aba Profissional */}
        <TabsContent value="job" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data de admissão *</Label>
              <Input type="date" {...register('hire_date')} />
              {errors.hire_date && <p className="text-xs text-red-500">{errors.hire_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de contrato *</Label>
              <Select
                defaultValue={defaultValues?.contract_type ?? 'clt'}
                onValueChange={(v) => setValue('contract_type', (v ?? 'clt') as EmployeeFormInput['contract_type'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="pj">PJ</SelectItem>
                  <SelectItem value="estagio">Estágio</SelectItem>
                  <SelectItem value="temporario">Temporário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Salário *</Label>
              <Input type="number" step="0.01" placeholder="0,00" {...register('salary')} />
              {errors.salary && <p className="text-xs text-red-500">{errors.salary.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                defaultValue={defaultValues?.status ?? 'active'}
                onValueChange={(v) => setValue('status', (v ?? 'active') as EmployeeFormInput['status'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="on_leave">Afastado</SelectItem>
                  <SelectItem value="terminated">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Select
                defaultValue={nn(defaultValues?.department_id)}
                onValueChange={(v) => { setValue('department_id', v ?? undefined); setValue('position_id', undefined) }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Select
                defaultValue={nn(defaultValues?.position_id)}
                onValueChange={(v) => setValue('position_id', v ?? undefined)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {filteredPositions.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        {/* Aba Banco & Endereço */}
        <TabsContent value="bank" className="space-y-6 pt-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Dados bancários</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input placeholder="Ex: Itaú" {...register('bank')} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de conta</Label>
                <Select
                  defaultValue={defaultValues?.account_type ?? 'corrente'}
                  onValueChange={(v) => setValue('account_type', (v ?? 'corrente') as 'corrente' | 'poupanca')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input placeholder="0000" {...register('agency')} />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input placeholder="00000-0" {...register('account')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Chave PIX</Label>
                <Input placeholder="CPF, e-mail, telefone ou chave aleatória" {...register('pix_key')} />
              </div>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Endereço</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input placeholder="00000-000" {...register('cep')} />
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input placeholder="123" {...register('number')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Rua</Label>
                <Input placeholder="Av. Paulista" {...register('street')} />
              </div>
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input placeholder="Apto 42" {...register('complement')} />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input placeholder="Centro" {...register('neighborhood')} />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input placeholder="São Paulo" {...register('city')} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Input placeholder="SP" maxLength={2} {...register('state')} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar colaborador
        </Button>
      </div>
    </form>
  )
}
