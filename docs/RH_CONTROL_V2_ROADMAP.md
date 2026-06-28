# RH Control V2 — Mapa de Gaps & Roadmap

Comparação entre a [spec oficial](./RH_CONTROL_V2_SPEC.md) e o que já existe no código.

## ✅ Já existe (precisa revisar/completar à luz da spec)
| Módulo | Rota atual | Observações |
|--------|-----------|-------------|
| Colaboradores | `/employees`, `/employees/[id]` | Falta CNH no cadastro; foto OK |
| Documentos do colaborador | `/documents`, `/meus-documentos` | Revisar categorias completas da spec + validade/alertas |
| Documentos RH | `/documents` | Confirmar confirmação de leitura |
| Ponto | `/attendance`, `/meu-ponto` | **Falta GPS, selfie, IP, dispositivo, cerca virtual** |
| Banco de horas | `/banco-horas` | Revisar fechamento + aprovação gestor |
| Agenda RH | `/calendario` | Incluir aniversários, ASO/contratos vencendo |
| Férias | `/vacations`, `/minhas-ferias` | Fluxo Colab→Gestor→RH a confirmar |
| Portal colaborador | `/meu-*` | **Falta virar PWA** |
| Organograma | `/organograma` | Revisar visual hierárquico |
| Desempenho | `/performance` | Falta autoavaliação + 360° |
| Comunicados / Mural | `/comunicados`, `/meus-comunicados` | OK; confirmar leitura |
| Chat interno | `/chat` | ✅ Construído 2026-06-15 (individual/setor/todos, realtime) |
| Assinatura digital | `/assinaturas`, `/sign/[token]` | Estender p/ equipamentos/advertências |
| Onboarding | `/onboarding` | Revisar checklist da spec |
| Dashboard | `/dashboard`, `/reports` | Estender p/ indicadores executivos (turnover, absenteísmo) |
| Billing SaaS | `/api/stripe/*` | **Spec pede ASAAS (PIX/boleto)** — decidir Stripe vs Asaas |
| Auditoria | `/audit-log` | OK |

## ❌ Novos módulos a construir
1. **White Label** — config por empresa (logo, nome, cores, login, rodapé) aplicado em todo o sistema, PDFs, e-mails.
2. **Atestados** — módulo dedicado (médico/CRM/CID/dias/arquivo) + indicadores de absenteísmo.
3. **Afastamentos e Ocorrências** — tipos (INSS, licenças, acidente, suspensão, advertência…).
4. **Crachá Inteligente** — frente + QR Code → página pública segura; revogar/reemitir/PDF.
5. **Controle de Equipamentos** — vínculo, entrega/devolução, assinatura, fotos, histórico.
6. **Offboarding** — checklist de desligamento.
7. **Treinamentos (LMS)** — vídeos/PDFs/quiz + certificados automáticos.
8. **Pesquisa de Clima** — questionários + relatórios.
9. **Alertas Automáticos** — engine de notificações (docs/ASO/contratos vencendo, etc.).
10. **Super Admin GRP** — painel global de clientes/assinaturas/faturamento.
11. **IA RH** — avaliações, feedback, absenteísmo, turnover, resumos, assistente, descrições de cargo.
12. **Integração ASAAS** — PIX/boleto/cartão/recorrência/webhooks/inadimplência.
13. **PWA** — manifest + service worker + offline (parcial já existe `/offline`, `/icons`).
14. **WhatsApp** — integração futura (avisos, holerites, etc.).

## 🗺️ Ordem sugerida (fases)
**Fase 1 — Fundação multiempresa de verdade**
- White Label (config + aplicação)
- Completar cadastro de colaborador (CNH) + categorias de documentos + validade
- Engine de Alertas Automáticos (base p/ vários módulos)

**Fase 2 — DP robusto**
- Ponto com GPS/selfie/IP/dispositivo/cerca virtual
- Atestados + Afastamentos/Ocorrências
- Banco de horas (fechamento + aprovação)

**Fase 3 — Ativos & ciclo de vida**
- Controle de Equipamentos (+ assinatura digital de entrega)
- Crachá Inteligente (QR público)
- Offboarding

**Fase 4 — Engajamento**
- Treinamentos (LMS) + certificados
- Pesquisa de Clima
- Desempenho 360° / autoavaliação

**Fase 5 — Negócio (SaaS)**
- Integração ASAAS (substituir/complementar Stripe)
- Super Admin GRP
- PWA completo

**Fase 6 — IA**
- Assistente RH + análises preditivas (turnover/absenteísmo) + geração de conteúdo

## ⚠️ Decisões pendentes (perguntar ao Gabriel)
- **Pagamento**: migrar de Stripe p/ ASAAS, ou manter os dois?
- **IA**: usar Claude (anthropic) — confirmar provider e orçamento de tokens.
- **WhatsApp**: reusar Evolution API do BelezaPro (já no VPS Hostinger)?
