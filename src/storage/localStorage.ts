import type { AppData } from '../types'

const STORAGE_KEY = 'glowguide-ai-data-v1'

const emptyData: AppData = { profile: null, checkIns: [], products: [], reflections: [] }

export function loadAppData(): AppData {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return emptyData
  const parsed: unknown = JSON.parse(stored)
  if (!parsed || typeof parsed !== 'object') throw new Error('Saved GlowGuide data could not be read.')
  const data = parsed as Partial<AppData>
  const savedProfile = data.profile ?? null
  const profile = savedProfile && savedProfile.displayName.trim().toLowerCase() !== 'friend'
    ? savedProfile
    : null
  return {
    profile,
    checkIns: Array.isArray(data.checkIns) ? data.checkIns : [],
    products: Array.isArray(data.products) ? data.products : [],
    reflections: Array.isArray(data.reflections) ? data.reflections : [],
  }
}

export function saveAppData(data: AppData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function clearAppData(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
