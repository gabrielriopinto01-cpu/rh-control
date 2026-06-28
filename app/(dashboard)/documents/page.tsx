'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { FileText, Upload, Search, Trash2, ExternalLink, Plus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import { DOC_LABELS, DOC_COLORS } from '@/lib/constants/documents'
import type { Document, Employee, DocumentType } from '@/types/database'

export const dynamic = 'force-dynamic'

type FormState = {
  employee_id: string
  type: DocumentType
  name: string
  file_url: string
  expires_at: string
  notes: string
}

type UploadMode = 'file' | 'url'

export default function DocumentsPage() {
  const { user } = useAuth()

  const [employees,   setEmployees]   = useState<Employee[]>([])
  const [documents,   setDocuments]   = useState<Document[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterType,  setFilterType]  = useState<DocumentType | 'all'>('all')
  const [filterEmp,   setFilterEmp]   = useState('all')
  const [dialog,      setDialog]      = useState(false)
  const [uploadMode,  setUploadMode]  = useState<UploadMode>('file')
  const [uploading,   setUploading]   = useState(false)
  const [uploadPct,   setUploadPct]   = useState(0)
  const [selectedFile,setSelectedFile]= useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const blankForm = (): FormState => ({
    employee_id: '', type: 'outro', name: '', file_url: '', expires_at: '', notes: '',
  })
  const [form, setForm] = useState<FormState>(blankForm)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [e, d] = await Promise.all([
      supabase.from('employees').select('*').eq('company_id', user.company_id)
        .eq('status', 'active').order('full_name'),
      supabase.from('documents').select('*').eq('company_id', user.company_id)
        .order('created_at', { ascending: false }),
    ])
    setEmployees(e.data ?? [])
    setDocuments(d.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setSelectedFile(f)
    if (!form.name) setForm(prev => ({ ...prev, name: f.name.replace(/\.[^.]+$/, '') }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!form.employee_id || !form.name) { toast.error('Colaborador e nome são obrigatórios'); return }

    let fileUrl = form.file_url

    // Upload para Supabase Storage
    if (uploadMode === 'file') {
      if (!selectedFile) { toast.error('Selecione um arquivo'); return }
      setUploading(true)
      setUploadPct(30)
      const supabase = createClient()
      const ext  = selectedFile.name.split('.').pop() ?? 'bin'
      const path = `${user.company_id}/${form.employee_id}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, selectedFile, { upsert: false })

      setUploadPct(80)
      if (uploadError) {
        setUploading(false)
        setUploadPct(0)
        // Se o bucket não existir ainda, orienta o usuário
        if (uploadError.message.includes('Bucket not found')) {
          toast.error('Crie o bucket "documents" no Supabase Storage (público) para usar upload.')
        } else {
          toast.error(`Erro no upload: ${uploadError.message}`)
        }
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(uploadData.path)
      fileUrl = publicUrl
      setUploadPct(100)
      setUploading(false)
    } else {
      if (!fileUrl) { toast.error('Informe a URL do arquivo'); return }
    }

    const supabase = createClient()
    const { error } = await supabase.from('documents').insert({
      company_id: user.company_id, employee_id: form.employee_id,
      type: form.type, name: form.name, file_url: fileUrl,
      expires_at: form.expires_at || null,
      notes: form.notes || null,
    })
    if (error) { toast.error('Erro ao salvar documento'); return }
    toast.success('Documento salvo!')
    setDialog(false)
    resetForm()
    load()
  }

  const resetForm = () => {
    setForm(blankForm())
    setSelectedFile(null)
    setUploadPct(0)
    setUploadMode('file')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm('Excluir este documento?')) return
    const supabase = createClient()
    // Tenta deletar do storage se for URL do Supabase
    if (fileUrl.includes('/storage/v1/')) {
      const path = fileUrl.split('/documents/')[1]
      if (path) await supabase.storage.from('documents').remove([path])
    }
    await supabase.from('documents').delete().eq('id', id)
    toast.success('Documento excluído')
    load()
  }

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.full_name ?? '—'

  const filtered = documents.filter(d => {
    if (filterType !== 'all' && d.type !== filterType) return false
    if (filterEmp !== 'all' && d.employee_id !== filterEmp) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) &&
        !getEmpName(d.employee_id).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const today     = new Date().toISOString().slice(0, 10)
  const in30days  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const isExpired      = (exp: string | null) => !!exp && exp < today
  const isExpiringSoon = (exp: string | null) => !!exp && exp >= today && exp <= in30days

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="text-gray-500 mt-1">Armazenamento de documentos dos colaboradores</p>
        </div>
        <Button onClick={() => { resetForm(); setDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" />Adicionar documento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar por nome ou colaborador..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select defaultValue="all" onValueChange={(v) => setFilterType((v ?? 'all') as typeof filterType)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(DOC_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select defaultValue="all" onValueChange={(v) => setFilterEmp(v ?? 'all')}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Colaborador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os colaboradores</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhum documento encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => {
            const expired      = isExpired(doc.expires_at)
            const expiringSoon = isExpiringSoon(doc.expires_at)
            return (
              <div key={doc.id}
                className={`bg-white rounded-xl border p-4 space-y-3 ${
                  expired ? 'border-red-200' : expiringSoon ? 'border-yellow-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{doc.name}</p>
                      <p className="text-xs text-gray-500 truncate">{getEmpName(doc.employee_id)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a href={doc.file_url} target="_blank" rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button onClick={() => handleDelete(doc.id, doc.file_url)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DOC_COLORS[doc.type]}`}>
                    {DOC_LABELS[doc.type]}
                  </span>
                  {doc.expires_at && (
                    <span className={`text-xs font-medium ${expired ? 'text-red-500' : expiringSoon ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {expired ? '⚠ Vencido' : expiringSoon ? '⚠ Vence em breve' : `Vence ${formatDate(doc.expires_at)}`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{formatDate(doc.created_at)}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={(o) => { if (!o) resetForm(); setDialog(o) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar documento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Colaborador *</Label>
              <Select defaultValue={form.employee_id || undefined}
                onValueChange={(v) => setForm(f => ({ ...f, employee_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select defaultValue={form.type}
                  onValueChange={(v) => setForm(f => ({ ...f, type: (v ?? 'outro') as DocumentType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input type="date" value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nome do documento *</Label>
              <Input placeholder="Ex: Contrato de trabalho 2024" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input placeholder="Notas adicionais (opcional)" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* Modo upload */}
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['file', 'url'] as const).map(mode => (
                  <button key={mode} type="button"
                    onClick={() => setUploadMode(mode)}
                    className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                      uploadMode === mode ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}>
                    {mode === 'file' ? 'Upload arquivo' : 'Colar URL'}
                  </button>
                ))}
              </div>

              {uploadMode === 'file' ? (
                <div>
                  <input ref={fileInputRef} type="file" className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileChange} />
                  {selectedFile ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
                      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-700 flex-1 truncate">{selectedFile.name}</span>
                      <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                        <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">Clique para selecionar</p>
                      <p className="text-xs text-gray-400 mt-0.5">PDF, DOC, JPG, PNG</p>
                    </button>
                  )}
                  {uploadPct > 0 && uploadPct < 100 && (
                    <Progress value={uploadPct} className="h-1.5 mt-2" />
                  )}
                </div>
              ) : (
                <Input placeholder="https://..." value={form.file_url}
                  onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => { resetForm(); setDialog(false) }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
