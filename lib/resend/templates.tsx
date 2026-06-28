// Templates de e-mail em HTML inline (sem dependência de @react-email)
// Compatível com todos os clientes de e-mail

export function holeritEmail(data: {
  employeeName: string
  companyName:  string
  refMonth:     string
  baseSalary:   number
  inss:         number
  irrf:         number
  fgts:         number
  netSalary:    number
  extras?:      { descricao: string; valor: number }[]
  discounts?:   { descricao: string; valor: number }[]
}) {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const extrasRows = (data.extras ?? []).map(e =>
    `<tr><td style="padding:6px 12px;color:#16a34a">${e.descricao}</td><td style="padding:6px 12px;text-align:right;color:#16a34a">+${fmt(e.valor)}</td></tr>`
  ).join('')

  const discountRows = (data.discounts ?? []).map(d =>
    `<tr><td style="padding:6px 12px;color:#dc2626">${d.descricao}</td><td style="padding:6px 12px;text-align:right;color:#dc2626">-${fmt(d.valor)}</td></tr>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:32px 40px">
      <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:8px;padding:8px 16px;margin-bottom:16px">
        <span style="color:#fff;font-weight:900;font-size:18px">RH</span>
        <span style="color:rgba(255,255,255,0.8);font-size:14px;margin-left:4px">Control</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:22px">Seu holerite está disponível</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Referência: ${data.refMonth}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px">
      <p style="color:#374151;font-size:15px;margin:0 0 24px">Olá, <strong>${data.employeeName}</strong>!</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Seu holerite referente ao mês de <strong>${data.refMonth}</strong> foi processado pela empresa <strong>${data.companyName}</strong>.</p>

      <!-- Tabela de verbas -->
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:16px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Descrição</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-top:1px solid #f3f4f6">
            <td style="padding:10px 12px;color:#374151">Salário Base</td>
            <td style="padding:10px 12px;text-align:right;font-weight:600;color:#374151">${fmt(data.baseSalary)}</td>
          </tr>
          ${extrasRows}
          <tr style="border-top:1px solid #f3f4f6">
            <td style="padding:10px 12px;color:#dc2626">(-) INSS</td>
            <td style="padding:10px 12px;text-align:right;color:#dc2626">-${fmt(data.inss)}</td>
          </tr>
          <tr style="border-top:1px solid #f3f4f6">
            <td style="padding:10px 12px;color:#dc2626">(-) IRRF</td>
            <td style="padding:10px 12px;text-align:right;color:#dc2626">-${fmt(data.irrf)}</td>
          </tr>
          ${discountRows}
          <tr style="border-top:2px solid #2563eb;background:#eff6ff">
            <td style="padding:12px;font-weight:700;color:#1e40af;font-size:15px">Salário Líquido</td>
            <td style="padding:12px;text-align:right;font-weight:700;color:#1e40af;font-size:16px">${fmt(data.netSalary)}</td>
          </tr>
        </tbody>
      </table>

      <p style="font-size:12px;color:#9ca3af;margin:16px 0 0">
        FGTS depositado este mês: <strong style="color:#6b7280">${fmt(data.fgts)}</strong>
      </p>

      <!-- CTA -->
      <div style="margin-top:28px;text-align:center">
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://rhcontrol.com.br'}/meus-holerites"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">
          Ver holerite completo
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
        Este e-mail foi enviado automaticamente pelo RH Control. Não responda este e-mail.
        <br>Em caso de dúvidas, procure o departamento de RH da sua empresa.
      </p>
    </div>
  </div>
</body>
</html>`
}

export function vacationApprovedEmail(data: {
  employeeName: string
  companyName:  string
  startDate:    string
  endDate:      string
  days:         number
  approvedBy:   string
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rhcontrol.com.br'
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 40px">
      <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:8px;padding:8px 16px;margin-bottom:16px">
        <span style="color:#fff;font-weight:900;font-size:18px">RH</span>
        <span style="color:rgba(255,255,255,0.8);font-size:14px;margin-left:4px">Control</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:22px">🌴 Férias aprovadas!</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">${data.companyName}</p>
    </div>
    <div style="padding:32px 40px">
      <p style="color:#374151;font-size:15px;margin:0 0 20px">Olá, <strong>${data.employeeName}</strong>!</p>
      <p style="color:#374151;font-size:15px;margin:0 0 28px">Suas férias foram <strong style="color:#059669">aprovadas</strong> por <strong>${data.approvedBy}</strong>.</p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <span style="color:#6b7280;font-size:14px">Início</span>
          <strong style="color:#065f46">${new Date(data.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <span style="color:#6b7280;font-size:14px">Retorno</span>
          <strong style="color:#065f46">${new Date(data.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
        </div>
        <div style="border-top:1px solid #bbf7d0;padding-top:12px;display:flex;justify-content:space-between">
          <span style="color:#6b7280;font-size:14px">Total de dias</span>
          <strong style="color:#059669;font-size:18px">${data.days} dias</strong>
        </div>
      </div>

      <div style="text-align:center">
        <a href="${appUrl}/minhas-ferias"
           style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">
          Ver minhas férias
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
        Boas férias! 🎉 Este e-mail foi enviado automaticamente pelo RH Control.
      </p>
    </div>
  </div>
</body>
</html>`
}

export function signatureRequestEmail(data: {
  employeeName: string
  companyName:  string
  documentName: string
  signUrl:      string
  expiresAt:    string
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#7c3aed,#8b5cf6);padding:32px 40px">
      <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:8px;padding:8px 16px;margin-bottom:16px">
        <span style="color:#fff;font-weight:900;font-size:18px">RH</span>
        <span style="color:rgba(255,255,255,0.8);font-size:14px;margin-left:4px">Control</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:22px">✍️ Documento aguarda sua assinatura</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">${data.companyName}</p>
    </div>
    <div style="padding:32px 40px">
      <p style="color:#374151;font-size:15px;margin:0 0 20px">Olá, <strong>${data.employeeName}</strong>!</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 8px">
        A empresa <strong>${data.companyName}</strong> enviou um documento para a sua assinatura eletrônica:
      </p>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px;margin:20px 0">
        <p style="margin:0;font-weight:700;color:#5b21b6;font-size:16px">📄 ${data.documentName}</p>
        <p style="margin:8px 0 0;font-size:13px;color:#7c3aed">Válido até: ${new Date(data.expiresAt).toLocaleDateString('pt-BR')}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:0 0 24px">
        Clique no botão abaixo para ler e assinar o documento. O link expira na data indicada acima.
      </p>
      <div style="text-align:center">
        <a href="${data.signUrl}"
           style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.3px">
          Assinar documento agora
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:20px 0 0">
        Ou acesse: <span style="color:#7c3aed">${data.signUrl}</span>
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
        Este e-mail foi enviado automaticamente pelo RH Control. Em caso de dúvidas, procure o RH da sua empresa.
      </p>
    </div>
  </div>
</body>
</html>`
}

export function welcomeEmail(data: {
  name:        string
  companyName: string
  loginUrl:    string
  tempPassword?: string
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:32px 40px">
      <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:8px;padding:8px 16px;margin-bottom:16px">
        <span style="color:#fff;font-weight:900;font-size:18px">RH</span>
        <span style="color:rgba(255,255,255,0.8);font-size:14px;margin-left:4px">Control</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:22px">Bem-vindo(a) ao RH Control!</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">${data.companyName}</p>
    </div>
    <div style="padding:32px 40px">
      <p style="color:#374151;font-size:15px;margin:0 0 20px">Olá, <strong>${data.name}</strong>!</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px">
        Você foi adicionado(a) ao sistema de RH da <strong>${data.companyName}</strong>.
        Agora você tem acesso à sua área do colaborador.
      </p>
      ${data.tempPassword ? `
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:24px">
        <p style="margin:0;font-size:13px;color:#92400e">
          <strong>Senha temporária:</strong> <code style="background:#fff;padding:2px 6px;border-radius:4px;font-size:14px">${data.tempPassword}</code>
          <br><span style="font-size:12px;margin-top:4px;display:block">Troque sua senha no primeiro acesso.</span>
        </p>
      </div>` : ''}
      <div style="text-align:center">
        <a href="${data.loginUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px">
          Acessar minha área
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
        Dúvidas? Fale com o RH da sua empresa.
      </p>
    </div>
  </div>
</body>
</html>`
}
