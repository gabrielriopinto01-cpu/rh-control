'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Building2, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type Employee = {
  id: string; full_name: string; position?: string; avatar_url?: string | null
  department_id?: string | null; manager_id?: string | null
  department?: { name: string } | null
}

type Department = { id: string; name: string }

type OrgNode = Employee & { reports: OrgNode[] }

function buildTree(employees: Employee[]): OrgNode[] {
  const map = new Map<string, OrgNode>()
  employees.forEach(e => map.set(e.id, { ...e, reports: [] }))

  const roots: OrgNode[] = []
  map.forEach(node => {
    if (node.manager_id && map.has(node.manager_id)) {
      map.get(node.manager_id)!.reports.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function Avatar({ emp }: { emp: Employee }) {
  const initials = emp.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return emp.avatar_url
    ? <img src={emp.avatar_url} alt={emp.full_name} className="h-10 w-10 rounded-full object-cover" />
    : (
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold">
        {initials}
      </div>
    )
}

function OrgCard({ node, depth = 0, search }: { node: OrgNode; depth?: number; search: string }) {
  const [open, setOpen] = useState(depth < 2)
  const hasReports = node.reports.length > 0

  const matchesSearch = !search ||
    node.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (node.position ?? '').toLowerCase().includes(search.toLowerCase())

  // Se busca ativa, só mostra ramos que fazem match
  const visibleReports = search
    ? node.reports.filter(r => {
        const selfMatch = r.full_name.toLowerCase().includes(search.toLowerCase()) || (r.position ?? '').toLowerCase().includes(search.toLowerCase())
        return selfMatch || r.reports.length > 0
      })
    : node.reports

  if (search && !matchesSearch && visibleReports.length === 0) return null

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        className={`relative bg-white border-2 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer select-none min-w-[160px] max-w-[200px] text-center ${
          depth === 0 ? 'border-blue-400 shadow-blue-100' :
          depth === 1 ? 'border-gray-300' : 'border-gray-200'
        } ${!matchesSearch && search ? 'opacity-40' : ''}`}
        onClick={() => hasReports && setOpen(o => !o)}
      >
        <div className="flex justify-center mb-2">
          <Avatar emp={node} />
        </div>
        <p className="font-semibold text-gray-900 text-sm leading-tight truncate px-1">{node.full_name}</p>
        {node.position && (
          <p className="text-xs text-gray-400 mt-0.5 truncate px-1">{node.position}</p>
        )}
        {node.department && depth === 0 && (
          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">
            {node.department.name}
          </div>
        )}
        {hasReports && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-100 rounded-full h-6 w-6 flex items-center justify-center border border-gray-200">
            {open
              ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
              : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
            }
          </div>
        )}
      </div>

      {/* Subordinados */}
      {hasReports && open && (
        <div className="mt-8">
          {/* Linha vertical */}
          <div className="flex justify-center">
            <div className="w-0.5 h-4 bg-gray-200" />
          </div>
          {/* Linha horizontal */}
          {visibleReports.length > 1 && (
            <div className="relative flex justify-center">
              <div
                className="h-0.5 bg-gray-200 absolute top-0"
                style={{ width: `${(visibleReports.length - 1) * 224}px` }}
              />
            </div>
          )}
          {/* Filhos */}
          <div className="flex gap-8 mt-0">
            {visibleReports.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-0.5 h-4 bg-gray-200" />
                <OrgCard node={child} depth={depth + 1} search={search} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DeptSection({ dept, employees, search }: { dept: Department; employees: Employee[]; search: string }) {
  const tree = buildTree(employees)
  if (tree.length === 0) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Building2 className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">{dept.name}</h2>
          <p className="text-xs text-gray-400">{employees.length} colaborador{employees.length !== 1 ? 'es' : ''}</p>
        </div>
      </div>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-8 min-w-max px-4">
          {tree.map(root => <OrgCard key={root.id} node={root} depth={0} search={search} />)}
        </div>
      </div>
    </div>
  )
}

export default function OrganogramaPage() {
  const { user }        = useAuth()
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [view,       setView]       = useState<'dept' | 'flat'>('dept')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return
    setLoading(true)
    const supabase = createClient()
    const [eRes, dRes] = await Promise.all([
      supabase.from('employees')
        .select('id, full_name, position, avatar_url, department_id, manager_id, department:departments(name)')
        .eq('company_id', user.company_id)
        .eq('status', 'active')
        .order('full_name'),
      supabase.from('departments')
        .select('id, name')
        .eq('company_id', user.company_id)
        .order('name'),
    ])
    setEmployees((eRes.data as Employee[]) ?? [])
    setDepartments((dRes.data as Department[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const semDept = employees.filter(e => !e.department_id)
  const total = employees.length

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organograma</h1>
            <p className="text-gray-500 text-sm">{total} colaborador{total !== 1 ? 'es' : ''} ativos · {departments.length} departamentos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['dept', 'flat'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                {v === 'dept' ? 'Por departamento' : 'Visão geral'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar..." className="pl-9 w-52" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Carregando organograma...</div>
      ) : total === 0 ? (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Users className="h-14 w-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">Nenhum colaborador cadastrado</p>
          <p className="text-gray-300 text-sm mt-1">Cadastre colaboradores para visualizar o organograma</p>
        </div>
      ) : view === 'dept' ? (
        <div className="space-y-10">
          {departments.map(dept => {
            const deptEmps = employees.filter(e => e.department_id === dept.id)
            return (
              <div key={dept.id} className="bg-white rounded-2xl border border-gray-200 p-6">
                <DeptSection dept={dept} employees={deptEmps} search={search} />
              </div>
            )
          })}
          {semDept.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <DeptSection
                dept={{ id: 'none', name: 'Sem departamento' }}
                employees={semDept}
                search={search}
              />
            </div>
          )}
        </div>
      ) : (
        // Visão geral — todos em uma árvore flat
        <div className="bg-white rounded-2xl border border-gray-200 p-6 overflow-x-auto">
          <div className="min-w-max">
            <div className="flex flex-wrap gap-8 justify-center pb-4">
              {buildTree(employees).map(root => (
                <OrgCard key={root.id} node={root} depth={0} search={search} />
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Clique em um card com subordinados para expandir/recolher · Arraste horizontalmente para navegar
      </p>
    </div>
  )
}
