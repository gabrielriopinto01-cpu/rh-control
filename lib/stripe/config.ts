import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
  typescript: true,
})

export const PLANS = {
  starter: {
    id:          'starter',
    name:        'Starter',
    description: 'Para pequenas empresas',
    price:       9700,          // R$ 97,00 em centavos
    priceId:     process.env.STRIPE_PRICE_STARTER ?? '',
    limits: {
      employees:  10,
      departments: 3,
    },
    features: [
      'Até 10 colaboradores',
      'Folha de pagamento',
      'Controle de ponto',
      'Férias e rescisão',
      'Área do colaborador (PWA)',
      'Suporte por e-mail',
    ],
    highlight: false,
  },
  professional: {
    id:          'professional',
    name:        'Professional',
    description: 'Para equipes em crescimento',
    price:       19700,
    priceId:     process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
    limits: {
      employees:  50,
      departments: 20,
    },
    features: [
      'Até 50 colaboradores',
      'Tudo do Starter',
      '13º Salário automatizado',
      'Calendário de equipe',
      'Log de auditoria',
      'Relatórios avançados',
      'Recrutamento',
      'Suporte prioritário',
    ],
    highlight: true,
  },
  enterprise: {
    id:          'enterprise',
    name:        'Enterprise',
    description: 'Para grandes empresas',
    price:       49700,
    priceId:     process.env.STRIPE_PRICE_ENTERPRISE ?? '',
    limits: {
      employees:  999,
      departments: 999,
    },
    features: [
      'Colaboradores ilimitados',
      'Tudo do Professional',
      'Multi-empresa',
      'API de integração',
      'Onboarding dedicado',
      'SLA 99,9%',
      'Gerente de conta',
    ],
    highlight: false,
  },
} as const

export type PlanId = keyof typeof PLANS
