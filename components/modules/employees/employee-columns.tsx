'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import type { Employee } from '@/types/database'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active:     { label: 'Ativo',      variant: 'default' },
  inactive:   { label: 'Inativo',    variant: 'secondary' },
  on_leave:   { label: 'Afastado',   variant: 'outline' },
  terminated: { label: 'Desligado',  variant: 'destructive' },
}

const CONTRACT_MAP: Record<string, string> = {
  clt:       'CLT',
  pj:        'PJ',
  estagio:   'Estágio',
  temporario:'Temporário',
}

interface RowActions {
  onView:    (id: string) => void
  onEdit?:   (id: string) => void
  onDelete?: (id: string) => void
}

export function getEmployeeColumns(actions: RowActions): ColumnDef<Employee>[] {
  return [
    {
      accessorKey: 'full_name',
      header: 'Colaborador',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {row.original.avatar_url && <AvatarImage src={row.original.avatar_url} alt={row.original.full_name} />}
            <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
              {getInitials(row.original.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-gray-900 text-sm">{row.original.full_name}</p>
            <p className="text-xs text-gray-500">{row.original.employee_code}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'contract_type',
      header: 'Contrato',
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-600">
          {CONTRACT_MAP[getValue() as string] ?? getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'salary',
      header: 'Salário',
      cell: ({ getValue }) => (
        <span className="text-sm font-medium text-gray-700">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'hire_date',
      header: 'Admissão',
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-600">{formatDate(getValue() as string)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = STATUS_MAP[getValue() as string]
        return <Badge variant={s?.variant ?? 'secondary'}>{s?.label ?? getValue() as string}</Badge>
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-gray-100 transition-colors outline-none">
            <MoreHorizontal className="h-4 w-4 text-gray-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => actions.onView(row.original.id)}>
              <Eye className="h-4 w-4 mr-2" /> Ver detalhes
            </DropdownMenuItem>
            {actions.onEdit && (
              <DropdownMenuItem onClick={() => actions.onEdit!(row.original.id)}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
            )}
            {actions.onDelete && (
              <DropdownMenuItem
                onClick={() => actions.onDelete!(row.original.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}
