import { z } from 'zod'

export const employeeSchema = z.object({
  full_name:     z.string().min(2, 'Nome obrigatório'),
  cpf:           z.string().min(11, 'CPF inválido').max(14, 'CPF inválido').transform((v) => v.replace(/\D/g, '')),
  rg:            z.string().optional(),
  birth_date:    z.string().optional(),
  hire_date:     z.string().min(1, 'Data de admissão obrigatória'),
  contract_type: z.enum(['clt', 'pj', 'estagio', 'temporario']),
  salary:        z.coerce.number().min(0, 'Salário inválido'),
  department_id: z.string().optional(),
  position_id:   z.string().optional(),
  status:        z.enum(['active', 'inactive', 'on_leave', 'terminated']).default('active'),
  email:         z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone:         z.string().optional(),
  cep:           z.string().optional(),
  street:        z.string().optional(),
  number:        z.string().optional(),
  complement:    z.string().optional(),
  neighborhood:  z.string().optional(),
  city:          z.string().optional(),
  state:         z.string().optional(),
  bank:          z.string().optional(),
  agency:        z.string().optional(),
  account:       z.string().optional(),
  account_type:  z.enum(['corrente', 'poupanca']).optional(),
  pix_key:       z.string().optional(),
})

export type EmployeeFormInput = z.input<typeof employeeSchema>
export type EmployeeFormData  = z.output<typeof employeeSchema>
