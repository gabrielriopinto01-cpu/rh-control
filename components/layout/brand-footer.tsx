'use client'

import { useBrandingStore } from '@/lib/store/branding-store'

export function BrandFooter() {
  const footer = useBrandingStore((s) => s.branding.footer)
  return (
    <footer className="hidden sm:flex flex-col items-center py-2.5 border-t border-gray-100 bg-white gap-0.5">
      {footer && (
        <p className="text-[11px] text-gray-400">{footer}</p>
      )}
      <p className="text-[11px] text-gray-400">
        Desenvolvido por{' '}
        <a
          href="https://grptecnologia.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
        >
          GRP Tecnologia
        </a>
      </p>
    </footer>
  )
}
