import { Resend } from 'resend'

// Lazy init — evita erro de build quando RESEND_API_KEY não está configurado
export const getResend = () => new Resend(process.env.RESEND_API_KEY ?? 'placeholder')

export const FROM_EMAIL = process.env.RESEND_FROM ?? 'RH Control <noreply@rhcontrol.com.br>'
