'use client'

import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { BarChart2, DollarSign, Palmtree } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

interface Props {
  empByStatus:       { name: string; value: number }[]
  empByContract:     { name: string; value: number }[]
  empByDept:         { name: string; count: number }[]
  vacationsByStatus: { name: string; value: number }[]
  payrollByMonth:    { month: string; bruto: number; liquido: number }[]
  yearFilter:        string
}

export default function ReportsCharts({
  empByStatus, empByContract, empByDept, vacationsByStatus, payrollByMonth, yearFilter,
}: Props) {
  return (
    <>
      {/* Status + Contrato */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-500" />
              Colaboradores por status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={empByStatus} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={70}
                  label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {empByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-purple-500" />
              Colaboradores por contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={empByContract} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={70}
                  label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {empByContract.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Por departamento */}
      {empByDept.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-teal-500" />
              Colaboradores por departamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={empByDept} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                <Tooltip formatter={(v) => [Number(v ?? 0), 'Colaboradores']} />
                <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Folha mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Folha de pagamento — {yearFilter}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payrollByMonth.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nenhuma folha gerada em {yearFilter}</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={payrollByMonth} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0))]} />
                <Legend />
                <Bar dataKey="bruto"   name="Bruto"   fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="liquido" name="Líquido" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Férias por status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palmtree className="h-4 w-4 text-yellow-500" />
            Férias por status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={vacationsByStatus} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={60}>
                {vacationsByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  )
}
