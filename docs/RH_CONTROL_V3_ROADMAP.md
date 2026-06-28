# RH Control V3 — Roadmap "Best-in-Class"

Objetivo: levar o RH Control de "completo" para **referência de mercado** para PMEs no Brasil.
Spec V2 já está ~90% implementada (ver `RH_CONTROL_V2_ROADMAP.md`). Esta lista é a evolução.

Prioridade: 🔴 alta (diferencial competitivo) · 🟡 média · 🟢 polish.

---

## 1. Conformidade & Legal (Brasil) 🔴
O que separa um RH "de verdade" dos genéricos.
- **eSocial** — geração dos eventos (admissão S-2200, afastamento S-2230, desligamento S-2299, etc.) em XML. Pelo menos exportação/relatório compatível.
- **Assinatura digital com validade jurídica** — hash + carimbo de tempo, trilha de auditoria robusta (já existe base em `digital_signatures`), opção de integração ICP-Brasil / certificado.
- **LGPD** — central de privacidade: consentimento, exportar dados do colaborador, anonimizar/excluir (direito ao esquecimento), log de acessos a dados pessoais.
- **Recibos/relatórios legais** — espelho de ponto conforme Portaria 671, recibo de férias, aviso prévio, TRCT (rescisão).

## 2. Folha de Pagamento robusta 🔴
- Cálculo automático de INSS/IRRF/FGTS com tabelas atualizadas (hoje é manual).
- Rubricas configuráveis (proventos/descontos), adiantamentos, vale-transporte/refeição, comissões.
- Geração de holerite em PDF com a marca (White Label) + envio automático (e-mail/WhatsApp já existem).
- Integração com o ponto/banco de horas para horas extras automáticas.

## 3. Recrutamento (ATS) profundo 🟡
- Página de carreiras pública por empresa (White Label) com vagas.
- Kanban de candidatos com arrastar-soltar entre etapas.
- Triagem de currículo por IA (já temos a engine) + score de aderência à vaga.
- Banco de talentos, e-mails automáticos por etapa.

## 4. Benefícios 🟡
- Gestão de benefícios (VT, VR, plano de saúde, odontológico) por colaborador.
- Custo de benefícios no dashboard e na folha.

## 5. Performance & OKRs 🟡
- OKRs/metas com acompanhamento trimestral (evoluir o módulo de desempenho).
- PDI (Plano de Desenvolvimento Individual) ligado a treinamentos.
- Matriz 9-box (potencial × desempenho) para sucessão.

## 6. Relatórios & BI 🔴
- Construtor de relatórios (escolher campos, filtros, agrupamento) + export Excel/PDF.
- Indicadores históricos com tendência (turnover 12 meses, headcount, custo médio).
- Dashboards por departamento e comparativos.

## 7. App Mobile nativo (ou PWA turbinado) 🟡
- PWA já existe; turbinar com notificações push (bater ponto, aprovar férias, comunicados).
- Reconhecimento facial/biometria no ponto (evoluir a selfie atual).

## 8. Automação & Workflows 🟡
- Engine de aprovações configurável (férias, despesas, ajustes de ponto) com múltiplos níveis.
- Fluxos automáticos (admissão dispara checklist + e-mails + acessos).
- Alertas já existem — adicionar disparo automático por e-mail/WhatsApp.

## 9. IA aplicada de verdade 🟢
(Engine pronta — ativar quando houver receita.)
- Resumo automático dos comentários da Pesquisa de Clima.
- Previsão de turnover (modelo simples sobre histórico).
- Assistente RH no Chat respondendo dúvidas de políticas.
- Análise de sentimento dos comunicados/clima.

## 10. Integrações 🟢
- ASAAS (pronto) — finalizar testes em sandbox.
- WhatsApp (pronto, multi-tenant) — conectar instâncias.
- Contabilidade (exportar folha p/ sistemas contábeis).
- Google/Microsoft SSO para login.
- API pública documentada (Enterprise).

## 11. Experiência & Qualidade 🟢
- Onboarding guiado do produto (tour na primeira vez).
- Acessibilidade (a11y) e modo escuro.
- Testes automatizados (e2e nos fluxos críticos) antes de escalar.
- Internacionalização (PT/EN/ES) para crescer.

---

## Ordem sugerida de execução (amanhã em diante)
1. **Folha automática (INSS/IRRF/FGTS)** + holerite PDF — é o coração do DP e o que mais vende.
2. **Espelho de ponto legal (Portaria 671)** + recibos (férias/rescisão).
3. **Construtor de relatórios + export Excel**.
4. **LGPD básico** (exportar/anonimizar dados do colaborador).
5. **ATS**: página de carreiras pública + kanban de candidatos.
6. **Workflows de aprovação** configuráveis.
7. eSocial (export), Benefícios, OKRs, push notifications.

> Cada item é incremental e não quebra o que já existe. Construir com migração `IF NOT EXISTS`,
> validar com `tsc` + `next build`, rodar SQL no Supabase, e seguir.
