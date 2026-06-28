import { create } from 'zustand'
import { DEFAULT_BRANDING } from '@/lib/branding'
import type { Branding } from '@/types/database'

interface BrandingStore {
  branding: Required<Branding>
  logoUrl: string | null
  setBranding: (b: Required<Branding>, logoUrl: string | null) => void
}

export const useBrandingStore = create<BrandingStore>((set) => ({
  branding: DEFAULT_BRANDING,
  logoUrl: null,
  setBranding: (branding, logoUrl) => set({ branding, logoUrl }),
}))
