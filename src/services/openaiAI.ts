import type { CheckIn, Product, Profile } from '../types'

export interface OpenAIReflectionResult {
  noticed: string
  patterns: string
  suggestions: string[]
}

interface ReflectionApiResponse extends Partial<OpenAIReflectionResult> {
  error?: string
}

export async function requestOpenAIReflection(profile: Profile, checkIn: CheckIn, recentCheckIns: CheckIn[], products: Product[]): Promise<OpenAIReflectionResult> {
  const reflectionContext = {
    profile: { skinType: profile.skinType, concerns: profile.concerns },
    checkIn: {
      date: checkIn.date,
      condition: checkIn.condition,
      feeling: checkIn.feeling,
      mood: checkIn.mood,
      productsUsed: getProductsUsed(checkIn, products),
      note: checkIn.note,
    },
    recentCheckIns: recentCheckIns.slice(0, 4).map((entry) => ({
      date: entry.date,
      condition: entry.condition,
      feeling: entry.feeling,
      mood: entry.mood,
      productsUsed: getProductsUsed(entry, products),
      note: entry.note,
    })),
  }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetch('/api/reflection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reflectionContext),
      signal: controller.signal,
    })
    const result: ReflectionApiResponse = await response.json()
    if (!response.ok) throw new Error(result.error || `Reflection service returned an error (${response.status}). Please retry.`)
    if (typeof result.noticed !== 'string' || !result.noticed.trim()) {
      throw new Error('The reflection service returned an unexpected response. Please retry.')
    }
    return {
      noticed: result.noticed,
      patterns: typeof result.patterns === 'string' ? result.patterns : '',
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.filter((item): item is string => typeof item === 'string') : [],
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('OpenAI took too long to respond. Your check-in is saved; please retry.', { cause: error })
    }
    if (error instanceof Error && !(error instanceof TypeError)) throw error
    throw new Error('Could not reach the reflection service. Check your connection and server configuration, then retry.', { cause: error })
  } finally {
    window.clearTimeout(timeout)
  }
}

function getProductsUsed(checkIn: CheckIn, products: Product[]): Array<{ name: string; type: string }> {
  return products
    .filter((product) => checkIn.productIds.includes(product.id))
    .map(({ name, type }) => ({ name, type }))
}
