# RH Control — Checklist de Go-Live 🚀

## 1. SUPABASE (Banco de dados)

- [ ] Criar novo projeto em https://supabase.com
- [ ] Copiar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Copiar `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role)
- [ ] Executar migrations em ordem no SQL Editor:
  - [ ] `supabase/migrations/001_initial_schema.sql`
  - [ ] `supabase/migrations/002_audit_log.sql`
  - [ ] `supabase/migrations/003_stripe_billing.sql`
  - [ ] `supabase/migrations/004_sprint_comercial.sql`
- [ ] Criar bucket `documents` em Storage (público ou privado)
- [ ] Criar bucket `avatars` em Storage (público)
- [ ] Ativar autenticação por e-mail (Auth → Providers → Email)
- [ ] Configurar URL de redirecionamento: `https://seudominio.com/auth/callback`

## 2. STRIPE (Pagamentos)

- [ ] Criar conta em https://stripe.com
- [ ] Criar 3 produtos recorrentes mensais:
  - Starter R$97/mês → copiar Price ID
  - Professional R$197/mês → copiar Price ID
  - Enterprise R$497/mês → copiar Price ID
- [ ] Copiar `STRIPE_SECRET_KEY` (Developers → API Keys)
- [ ] Configurar Webhook:
  - URL: `https://seudominio.com/api/stripe/webhook`
  - Eventos: `checkout.session.completed`, `customer.subscription.updated`,
    `customer.subscription.deleted`, `invoice.payment_failed`
  - Copiar `STRIPE_WEBHOOK_SECRET`
- [ ] Ativar Billing Portal (Stripe Dashboard → Settings → Billing)

## 3. RESEND (E-mails)

- [ ] Criar conta em https://resend.com
- [ ] Adicionar e verificar domínio (DNS)
- [ ] Criar API Key → `RESEND_API_KEY`
- [ ] Definir e-mail de envio → `RESEND_FROM`

## 4. VERCEL (Deploy)

- [ ] Importar repositório GitHub em https://vercel.com
- [ ] Configurar variáveis de ambiente:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://seudominio.com
NEXT_PUBLIC_APP_NAME=RH Control

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...

RESEND_API_KEY=re_...
RESEND_FROM=RH Control <noreply@seudominio.com>
```

- [ ] Fazer deploy → aguardar build verde ✅
- [ ] Configurar domínio customizado (opcional)

## 5. PÓS-DEPLOY

- [ ] Acessar `https://seudominio.com` → ver landing page
- [ ] Registrar conta de administrador em `/register`
- [ ] Copiar `company_id` da tabela `companies` no Supabase
- [ ] Executar `supabase/seed_demo.sql` substituindo o ID (para demos)
- [ ] Testar fluxo completo:
  - [ ] Login / registro
  - [ ] Criar colaborador
  - [ ] Bater ponto
  - [ ] Gerar folha
  - [ ] Enviar holerite por e-mail
  - [ ] Criar assinatura digital e assinar pelo link
  - [ ] Criar comunicado e confirmar leitura
- [ ] Testar no celular (PWA install banner)
- [ ] Testar checkout Stripe (modo teste)

## 6. PRIMEIRO CLIENTE

Roteiro de demonstração (15 min):
1. **Landing page** — mostrar planos e funcionalidades
2. **Onboarding** — criar empresa ao vivo (3 min)
3. **Colaboradores** — cadastrar 1 pessoa
4. **Ponto digital** — mostrar tela do colaborador no celular
5. **Folha** — gerar e enviar holerite por e-mail
6. **Assinatura digital** — enviar contrato e assinar ao vivo
7. **Comunicados** — criar aviso e mostrar na área do colaborador
8. **Organograma** — mostrar estrutura visual
9. **Planos** — apresentar preços e fazer checkout ao vivo

---

**Tempo total para ir ao ar: ~2 horas**
**Custo mensal de infraestrutura: R$ 0 (Supabase free + Vercel free)**
**Primeiro cliente fecha em: o quanto antes 💪**
