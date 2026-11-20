export type SkinType = 'Oily' | 'Dry' | 'Combination' | 'Normal' | 'Sensitive'
export type SkinConcern = 'Acne' | 'Dryness' | 'Oiliness' | 'Irritation' | 'Dark spots'
export type SkinCondition = 'Clear' | 'Breakout' | 'Dry' | 'Oily' | 'Irritated' | 'Other'
export type SkinMood = 'Calm' | 'Comfortable' | 'Tight' | 'Itchy' | 'Tender' | 'Frustrated'

export interface Profile {
  displayName: string
  skinType: SkinType
  concerns: SkinConcern[]
}

export interface Product {
  id: string
  name: string
  type: string
  dateStarted: string
  notes: string
}

export interface CheckIn {
  id: string
  date: string
  condition: SkinCondition
  feeling: string
  mood: SkinMood
  productIds: string[]
  note: string
  photoDataUrl?: string
  createdAt: string
}

export interface Reflection {
  checkInId: string
  status: 'pending' | 'complete' | 'error'
  noticed: string
  patterns: string
  suggestions: string[]
  error?: string
  createdAt: string
}

export interface AppData {
  profile: Profile | null
  checkIns: CheckIn[]
  products: Product[]
  reflections: Reflection[]
}
