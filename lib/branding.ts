import type { Branding } from '@/types/database'

export const DEFAULT_BRANDING: Required<Branding> = {
  primary:     '#2563eb',
  secondary:   '#1e40af',
  button:      '#2563eb',
  system_name: 'RH Control',
  tagline:     'Gestão de pessoas',
  footer:      '',
}

export function resolveBranding(b?: Branding | null): Required<Branding> {
  return {
    primary:     b?.primary     || DEFAULT_BRANDING.primary,
    secondary:   b?.secondary   || DEFAULT_BRANDING.secondary,
    button:      b?.button      || DEFAULT_BRANDING.button,
    system_name: b?.system_name || DEFAULT_BRANDING.system_name,
    tagline:     b?.tagline     || DEFAULT_BRANDING.tagline,
    footer:      b?.footer      || DEFAULT_BRANDING.footer,
  }
}

/** Aplica as cores da marca como variáveis CSS no documento. */
export function applyBrandingVars(b: Required<Branding>) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--brand', b.primary)
  root.style.setProperty('--brand-secondary', b.secondary)
  root.style.setProperty('--brand-button', b.button)
  // Faz os botões/realces primários do design system seguirem a marca
  root.style.setProperty('--primary', b.button)
  root.style.setProperty('--primary-foreground', '#ffffff')
  root.style.setProperty('--ring', b.primary)
  root.style.setProperty('--sidebar-primary', b.primary)
}
