import type { DocumentType } from '@/types/database'

export const DOC_LABELS: Record<DocumentType, string> = {
  cpf: 'CPF', rg: 'RG', cnh: 'CNH', ctps: 'CTPS', pis: 'PIS',
  comprovante_residencia: 'Comprovante de Residência',
  contrato: 'Contrato', ficha_registro: 'Ficha de Registro',
  admissao: 'Admissão', demissao: 'Demissão',
  exame_admissional: 'Exame Admissional', exame_periodico: 'Exame Periódico',
  exame_demissional: 'Exame Demissional', aso: 'ASO',
  certificado: 'Certificado', treinamento: 'Treinamento',
  advertencia: 'Advertência', epi: 'EPI', holerite: 'Holerite',
  ferias: 'Férias', atestado: 'Atestado', outro: 'Outro',
}

export const DOC_COLORS: Record<DocumentType, string> = {
  cpf: 'bg-blue-100 text-blue-700', rg: 'bg-indigo-100 text-indigo-700',
  cnh: 'bg-sky-100 text-sky-700',
  ctps: 'bg-purple-100 text-purple-700', pis: 'bg-violet-100 text-violet-700',
  comprovante_residencia: 'bg-cyan-100 text-cyan-700',
  contrato: 'bg-green-100 text-green-700', ficha_registro: 'bg-emerald-100 text-emerald-700',
  admissao: 'bg-teal-100 text-teal-700', demissao: 'bg-red-100 text-red-700',
  exame_admissional: 'bg-lime-100 text-lime-700', exame_periodico: 'bg-amber-100 text-amber-700',
  exame_demissional: 'bg-rose-100 text-rose-700', aso: 'bg-green-100 text-green-700',
  certificado: 'bg-yellow-100 text-yellow-700', treinamento: 'bg-fuchsia-100 text-fuchsia-700',
  advertencia: 'bg-red-100 text-red-700', epi: 'bg-orange-100 text-orange-700',
  holerite: 'bg-blue-100 text-blue-700',
  ferias: 'bg-yellow-100 text-yellow-700', atestado: 'bg-orange-100 text-orange-700',
  outro: 'bg-gray-100 text-gray-700',
}
