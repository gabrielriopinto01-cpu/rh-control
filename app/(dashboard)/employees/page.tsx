'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DataTable } from '@/components/tables/data-table'
import { EmployeeForm } from '@/components/modules/employees/employee-form'
import { getEmployeeColumns } from '@/components/modules/employees/employee-columns'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Employee, Department, Position } from '@/types/database'
import type { EmployeeFormData } from '@/lib/validations/employee'

export default function EmployeesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions]     = useState<Position[]>([])
  const [loading, setLoading]         = useState(true)
  const [sheetOpen, setSheetOpen]     = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [emp, dept, pos] = await Promise.all([
      supabase.from('employees').select('*').eq('company_id', user.company_id).order('full_name'),
      supabase.from('departments').select('*').eq('company_id', user.company_id).order('name'),
      supabase.from('positions').select('*').eq('company_id', user.company_id).order('title'),
    ])
    setEmployees(emp.data ?? [])
    setDepartments(dept.data ?? [])
    setPositions(pos.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const editingEmployee = editingId ? employees.find((e) => e.id === editingId) : undefined

  const defaultValues = editingEmployee ? {
    full_name:     editingEmployee.full_name,
    cpf:           editingEmployee.cpf,
    rg:            editingEmployee.rg ?? '',
    birth_date:    editingEmployee.birth_date ?? '',
    hire_date:     editingEmployee.hire_date,
    contract_type: editingEmployee.contract_type,
    salary:        editingEmployee.salary,
    department_id: editingEmployee.department_id ?? '',
    position_id:   editingEmployee.position_id ?? '',
    status:        editingEmployee.status,
    bank:          editingEmployee.bank_details?.bank ?? '',
    agency:        editingEmployee.bank_details?.agency ?? '',
    account:       editingEmployee.bank_details?.account ?? '',
    account_type:  editingEmployee.bank_details?.account_type ?? 'corrente',
    pix_key:       editingEmployee.bank_details?.pix_key ?? '',
    cep:           editingEmployee.address?.cep ?? '',
    street:        editingEmployee.address?.street ?? '',
    number:        editingEmployee.address?.number ?? '',
    complement:    editingEmployee.address?.complement ?? '',
    neighborhood:  editingEmployee.address?.neighborhood ?? '',
    city:          editingEmployee.address?.city ?? '',
    state:         editingEmployee.address?.state ?? '',
  } : undefined

  const handleSubmit = async (data: EmployeeFormData, avatarUrl?: string | null) => {
    if (!isSupabaseConfigured() || !user) {
      toast.error('Configure o Supabase no .env.local')
      return
    }
    const supabase = createClient()
    const payload = {
      company_id:    user.company_id,
      avatar_url:    avatarUrl ?? null,
      full_name:     data.full_name,
      cpf:           data.cpf,
      rg:            data.rg ?? null,
      birth_date:    data.birth_date || null,
      hire_date:     data.hire_date,
      contract_type: data.contract_type,
      salary:        data.salary,
      department_id: data.department_id || null,
      position_id:   data.position_id || null,
      status:        data.status,
      bank_details:  data.bank ? {
        bank: data.bank, agency: data.agency ?? '', account: data.account ?? '',
        account_type: data.account_type ?? 'corrente', pix_key: data.pix_key ?? null,
      } : null,
      address: data.cep ? {
        cep: data.cep, street: data.street ?? '', number: data.number ?? '',
        complement: data.complement ?? null, neighborhood: data.neighborhood ?? '',
        city: data.city ?? '', state: data.state ?? '',
      } : null,
    }

    if (editingId) {
      const { error } = await supabase.from('employees').update(payload).eq('id', editingId)
      if (error) { toast.error('Erro ao atualizar colaborador'); return }
      toast.success('Colaborador atualizado!')
    } else {
      const { error } = await supabase.from('employees').insert({ ...payload, employee_code: '' })
      if (error) { toast.error('Erro ao cadastrar colaborador'); return }
      toast.success('Colaborador cadastrado!')
    }
    setSheetOpen(false)
    setEditingId(null)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este colaborador?')) return
    const supabase = createClient()
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Colaborador excluído')
    load()
  }

  const columns = getEmployeeColumns({
    onView:   (id) => router.push(`/employees/${id}`),
    onEdit:   (id) => { setEditingId(id); setSheetOpen(true) },
    onDelete: handleDelete,
  })

  const stats = [
    { label: 'Total',      value: employees.length,                                      color: 'text-blue-600' },
    { label: 'Ativos',     value: employees.filter((e) => e.status === 'active').length,  color: 'text-green-600' },
    { label: 'Afastados',  value: employees.filter((e) => e.status === 'on_leave').length, color: 'text-orange-600' },
    { label: 'Desligados', value: employees.filter((e) => e.status === 'terminated').length, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Colaboradores</h1>
          <p className="text-gray-500 mt-1">Gerencie os colaboradores da empresa</p>
        </div>
        <Button onClick={() => { setEditingId(null); setSheetOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo colaborador
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <DataTable
          columns={columns}
          data={employees}
          loading={loading}
          searchColumn="full_name"
          searchPlaceholder="Buscar colaborador..."
        />
      </div>

      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditingId(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingId ? 'Editar colaborador' : 'Novo colaborador'}</SheetTitle>
          </SheetHeader>
          <EmployeeForm
            defaultValues={defaultValues}
            departments={departments}
            positions={positions}
            companyId={user?.company_id}
            initialAvatarUrl={editingEmployee?.avatar_url}
            onSubmit={handleSubmit}
            onCancel={() => { setSheetOpen(false); setEditingId(null) }}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
