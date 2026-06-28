import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CandidatarForm from './form'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function CandidatarPage({ params }: { params: Promise<{ slug: string; jobId: string }> }) {
  const { slug, jobId } = await params

  const { data: company } = await admin.from('companies').select('id, name, logo_url').eq('slug', slug).single()
  if (!company) notFound()

  const { data: job } = await admin
    .from('job_openings')
    .select('id, title, description')
    .eq('id', jobId)
    .eq('company_id', company.id)
    .eq('status', 'open')
    .single()
  if (!job) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-xl mx-auto px-4 py-6 flex items-center gap-3">
          {company.logo_url && <img src={company.logo_url} alt={company.name} className="h-10 w-10 rounded-lg object-contain border" />}
          <div>
            <p className="text-xs text-gray-400">{company.name}</p>
            <h1 className="text-lg font-bold text-gray-900">{job.title}</h1>
          </div>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 py-8">
        <CandidatarForm jobId={job.id} jobTitle={job.title} companyName={company.name} />
      </div>
      <footer className="text-center py-6 text-xs text-gray-400">
        Desenvolvido por <span className="font-medium">GRP Tecnologia</span> · RH Control
      </footer>
    </div>
  )
}
