import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data: company } = await admin.from('companies').select('name').eq('slug', slug).single()
  return { title: company ? `Vagas — ${company.name}` : 'Vagas' }
}

export default async function CarreirasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: company } = await admin
    .from('companies')
    .select('id, name, logo_url, document')
    .eq('slug', slug)
    .single()

  if (!company) notFound()

  const { data: jobs } = await admin
    .from('job_openings')
    .select('id, title, description, requirements, open_date')
    .eq('company_id', company.id)
    .eq('status', 'open')
    .order('open_date', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-8 flex items-center gap-4">
          {company.logo_url && (
            <img src={company.logo_url} alt={company.name} className="h-14 w-14 rounded-xl object-contain border" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">Vagas abertas</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        {!jobs || jobs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">Nenhuma vaga aberta no momento</p>
            <p className="text-sm mt-1">Volte em breve para conferir novas oportunidades.</p>
          </div>
        ) : jobs.map(job => (
          <div key={job.id} className="bg-white rounded-xl border border-gray-200 p-6 space-y-3 hover:shadow-sm transition-shadow">
            <h2 className="text-lg font-semibold text-gray-900">{job.title}</h2>
            {job.description && <p className="text-gray-600 text-sm leading-relaxed">{job.description}</p>}
            {job.requirements && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Requisitos</p>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{job.requirements}</p>
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-400">
                Publicada em {new Date(job.open_date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </p>
              <a
                href={`/carreiras/${slug}/candidatar/${job.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Candidatar-se
              </a>
            </div>
          </div>
        ))}
      </div>

      <footer className="text-center py-8 text-xs text-gray-400">
        Desenvolvido por <span className="font-medium">GRP Tecnologia</span> · RH Control
      </footer>
    </div>
  )
}
