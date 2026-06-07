'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { departmentSchema, type DepartmentFormData } from '@/lib/validations/department'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { nn } from '@/lib/utils'
import type { Department, Employee } from '@/types/database'

interface DepartmentFormProps {
  defaultValues?: Partial<DepartmentFormData>
  departments: Department[]
  managers: Employee[]
  onSubmit: (data: DepartmentFormData) => Promise<void>
  onCancel: () => void
}

export function DepartmentForm({ defaultValues, departments, managers, onSubmit, onCancel }: DepartmentFormProps) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } =
    useForm<DepartmentFormData>({ resolver: zodResolver(departmentSchema), defaultValues })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label>Nome do departamento *</Label>
        <Input placeholder="Ex: Tecnologia da Informação" {...register('name')} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Departamento pai (opcional)</Label>
        <Select defaultValue={nn(defaultValues?.parent_id)} onValueChange={(v) => setValue('parent_id', v ?? undefined)}>
          <SelectTrigger><SelectValue placeholder="Nenhum (departamento raiz)" /></SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Gestor responsável (opcional)</Label>
        <Select defaultValue={nn(defaultValues?.manager_id)} onValueChange={(v) => setValue('manager_id', v ?? undefined)}>
          <SelectTrigger><SelectValue placeholder="Selecione um gestor..." /></SelectTrigger>
          <SelectContent>
            {managers.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  )
}
