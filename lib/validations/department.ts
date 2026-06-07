import { z } from 'zod'

export const departmentSchema = z.object({
  name:       z.string().min(2, 'Nome obrigatório'),
  manager_id: z.string().optional(),
  parent_id:  z.string().optional(),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>

export const positionSchema = z.object({
  title:         z.string().min(2, 'Cargo obrigatório'),
  department_id: z.string().optional(),
  salary_min:    z.coerce.number().optional(),
  salary_max:    z.coerce.number().optional(),
  cbo_code:      z.string().optional(),
})

export type PositionFormInput = z.input<typeof positionSchema>
export type PositionFormData  = z.output<typeof positionSchema>
