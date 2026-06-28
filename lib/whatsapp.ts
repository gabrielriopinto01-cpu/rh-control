// Integração com a Evolution API (WhatsApp) — server-side, MULTI-TENANT.
// Cada empresa tem a própria instância (o próprio número).
// Configurar no .env.local (GLOBAL — é o seu servidor Evolution):
//   EVOLUTION_API_URL=http://SEU_IP:8080
//   EVOLUTION_API_KEY=sua_api_key_global

export function isWhatsappConfigured(): boolean {
  return !!process.env.EVOLUTION_API_URL && !!process.env.EVOLUTION_API_KEY
}

const baseUrl = () => process.env.EVOLUTION_API_URL!.replace(/\/$/, '')
const headers = () => ({ 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY! })

/** Nome da instância de uma empresa. */
export function instanceName(companyId: string): string {
  return `rh_${companyId.replace(/-/g, '').slice(0, 16)}`
}

/** Normaliza um telefone BR para o formato da Evolution (DDI + DDD + número, só dígitos). */
export function normalizePhone(raw: string): string | null {
  let d = (raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length <= 11) d = '55' + d
  if (d.length < 12 || d.length > 13) return null
  return d
}

/** Cria a instância (idempotente — se já existir, a Evolution retorna erro que ignoramos). */
export async function createInstance(instance: string): Promise<void> {
  if (!isWhatsappConfigured()) return
  try {
    await fetch(`${baseUrl()}/instance/create`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ instanceName: instance, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
    })
  } catch (err) {
    console.error('createInstance error:', err)
  }
}

/** Retorna o QR Code (base64) para conectar a instância. */
export async function getQrCode(instance: string): Promise<string | null> {
  if (!isWhatsappConfigured()) return null
  try {
    const res = await fetch(`${baseUrl()}/instance/connect/${instance}`, { headers: headers() })
    if (!res.ok) return null
    const data = await res.json()
    return data?.base64 ?? data?.qrcode?.base64 ?? null
  } catch (err) {
    console.error('getQrCode error:', err)
    return null
  }
}

/** Estado da conexão: 'open' (conectado), 'connecting', 'close' ou null. */
export async function connectionState(instance: string): Promise<string | null> {
  if (!isWhatsappConfigured()) return null
  try {
    const res = await fetch(`${baseUrl()}/instance/connectionState/${instance}`, { headers: headers() })
    if (!res.ok) return null
    const data = await res.json()
    return data?.instance?.state ?? data?.state ?? null
  } catch (err) {
    console.error('connectionState error:', err)
    return null
  }
}

/** Envia uma mensagem de texto pela instância da empresa. */
export async function sendText(instance: string, to: string, text: string): Promise<boolean> {
  if (!isWhatsappConfigured() || !instance) return false
  const number = normalizePhone(to)
  if (!number) return false
  try {
    const res = await fetch(`${baseUrl()}/message/sendText/${instance}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ number, text }),
    })
    return res.ok
  } catch (err) {
    console.error('whatsapp sendText error:', err)
    return false
  }
}
