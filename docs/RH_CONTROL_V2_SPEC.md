# RH Control V2 — Especificação Oficial do Produto

> Plataforma SaaS multiempresa de Gestão de Pessoas, DP, Ponto, Comunicação,
> Treinamentos, Documentos e Autoatendimento do Colaborador.
> Público: clínicas, laboratórios, assistências técnicas, escritórios, prestadoras
> de serviço e PMEs. Objetivo: mais simples, moderno e completo que os concorrentes.

---

## Arquitetura multiempresa
Cada empresa: usuários, colaboradores, configurações, identidade visual, documentos
e relatórios independentes. **Isolamento total** — nenhuma empresa vê dados de outra (RLS).

## White Label
Personalização por cliente: logo, nome do sistema/empresa, cores (principal,
secundária, botões), tela de login, rodapé. Aplicar em: login, dashboard, portal
do colaborador, relatórios, PDFs, crachás, certificados, e-mails.

## Gestão de Colaboradores
Cadastro completo: foto, nome, CPF, RG, CNH, nascimento, endereço, telefone, e-mail,
cargo, setor, gestor responsável, salário, admissão, desligamento, tipo de contrato,
status ativo/inativo.

## Documentos do Colaborador
Vinculados ao colaborador. Categorias: RG, CPF, CNH, CTPS, comprovante de residência,
contrato, ficha de registro, exame admissional/periódico/demissional, ASO,
certificados, treinamentos, advertências, EPI, holerites, Outros (nome/categoria/
descrição/data/validade/observações personalizados). Upload PDF/imagem, visualização
rápida, download, busca, filtros, histórico.

## Documentos RH (corporativos)
Políticas, normas, procedimentos, regulamentos, comunicados, contratos padrão,
modelos de advertência/declaração. Upload, categorias, controle de acesso,
confirmação de leitura.

## Controle de Ponto
Registro via computador/navegador/celular/portal. Campos: data, hora, GPS (lat/long),
endereço, selfie, IP, dispositivo. Marcações: entrada, saída almoço, retorno almoço,
saída final. Recursos: cerca virtual, geolocalização, aprovação de ajustes, auditoria,
espelho de ponto.

## Banco de Horas
Horas extras, negativas, compensações, atrasos, faltas. Dashboard: saldo atual,
histórico, fechamento mensal, aprovação do gestor.

## Afastamentos e Ocorrências
Tipos: INSS, licença maternidade/paternidade/óbito/casamento, acidente de trabalho,
suspensão, falta com/sem abono, advertência, outros. Campos: período, motivo, anexos,
observações.

## Atestados
Médico, CRM, CID (opcional), dias concedidos, arquivo. Indicadores: absenteísmo,
ranking de afastamentos, relatórios.

## Agenda RH
Férias, afastamentos, licenças, atestados, aniversários, contratos vencendo, ASO
vencendo, treinamentos, eventos. Visualização dia/semana/mês.

## Férias
Solicitação online. Fluxo: Colaborador → Gestor → RH. Aprovação/reprovação,
histórico, notificações.

## Portal do Colaborador (PWA)
Bater ponto, banco de horas, espelho de ponto, solicitar férias, enviar atestados,
consultar documentos, baixar holerites, ver comunicados, ver treinamentos, baixar
certificados. **Transformar em PWA.**

## Crachá Inteligente
Frente: foto, nome, cargo, setor, matrícula. Verso: QR Code → página segura (dados
básicos, status, empresa, contato). Revogar QR, reemitir crachá, exportar PDF.

## Controle de Equipamentos
Vincular ao colaborador: notebook, celular, tablet, ferramentas, uniformes, veículos,
chaves, cartões corporativos, crachás. Entrega, devolução, histórico, assinatura
digital, fotos.

## Onboarding
Checklist de admissão: documentos recebidos, contrato assinado, e-mail criado,
uniforme/equipamentos entregues, treinamentos concluídos. Acompanhamento visual.

## Offboarding
Checklist de desligamento: receber equipamentos, encerrar acessos/e-mail,
documentação final, termos assinados.

## Organograma
Visual hierárquico: Diretor → Gerente → Coordenador → Supervisor → Colaborador.

## Treinamentos (LMS)
Vídeos, PDFs, materiais, avaliações, questionários. Certificados automáticos.

## Avaliação de Desempenho
Autoavaliação, avaliação do gestor, 360°. Metas, evolução, histórico.

## Pesquisa de Clima
Questionários internos. Relatórios: satisfação, engajamento, ambiente organizacional.

## Comunicação Interna
- **Mural Corporativo**: publicações de RH/gestores/diretoria (texto, imagem, PDF),
  confirmação de leitura.
- **Chat Interno**: por setor, equipe, empresa.

## WhatsApp (futuro)
Avisos, férias, holerites, treinamentos, documentos.

## Dashboard Executivo
Colaboradores ativos, atrasos, faltas, banco de horas, horas extras, atestados,
férias, turnover, absenteísmo, documentos vencendo. Gráficos: evolução mensal,
comparativos, indicadores por setor.

## Assinatura Digital
Contratos, advertências, termos, entregas de equipamentos, documentos RH.

## Alertas Automáticos
Documentos/ASO/contratos vencendo, férias próximas, banco de horas elevado, muitas
faltas, muitos atestados.

## Integração ASAAS
Assinaturas SaaS: PIX, boleto, cartão, recorrência, webhooks, inadimplência.

## Super Admin GRP
Painel exclusivo: clientes, assinaturas, faturamento, empresas ativas/bloqueadas,
uso do sistema, suporte.

## IA RH Control
Geração de avaliações, sugestão de feedback, análise de absenteísmo, previsão de
turnover, resumo de colaboradores, assistente virtual RH, geração de descrições de cargo.

## Diferencial estratégico
Unir RH + DP + Ponto + Banco de Horas + Documentos + Portal + Treinamentos +
Comunicação + Equipamentos + White Label + Assinatura SaaS + Dashboard + IA.
Foco: simplicidade, velocidade, mobile, facilidade de uso, mais recursos e menor custo
que os concorrentes.
