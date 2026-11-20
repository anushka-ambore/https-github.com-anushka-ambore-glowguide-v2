export interface GeminiSettings {
  apiKey?: string
  endpoint?: string
  model?: string
}

export class GeminiApiError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GeminiApiError'
    this.statusCode = statusCode
  }
}

interface ReflectionContext {
  profile: { skinType: string; concerns: string[] }
  checkIn: {
    date: string
    condition: string
    feeling: string
    mood: string
    productsUsed: Array<{ name: string; type: string }>
    note: string
  }
  recentCheckIns: ReflectionContext['checkIn'][]
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string }
}

interface ReflectionOutput {
  noticed?: string
  patterns?: string
  suggestions?: string[]
}

export interface GeminiReflectionResult {
  noticed: string
  patterns: string
  suggestions: string[]
}

export async function generateGeminiReflection(input: unknown, settings: GeminiSettings): Promise<GeminiReflectionResult> {
  const apiKey = settings.apiKey
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new GeminiApiError('Google Gemini is not configured on the server. Add GEMINI_API_KEY, then retry.', 503)
  }

  const reflectionContext = normalizeContext(input)
  const endpoint = (settings.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models').replace(/\/$/, '')
  const model = settings.model || 'gemini-2.5-flash'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const response = await fetch(`${endpoint}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'You are GlowGuide, a kind and non-medical skin reflection coach. Based only on the user’s recorded observations, return a JSON object with three fields: noticed (a warm observation), patterns (a cautious possible pattern or an empty string), and suggestions (an array of gentle everyday habit ideas). Never diagnose, make medical claims, recommend treatments, or claim a product caused a change. Clearly avoid certainty. Keep suggestions simple and supportive.',
          }],
        },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(reflectionContext) }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 512 },
      }),
      signal: controller.signal,
    })

    const result = await response.json() as GeminiResponse
    if (!response.ok) throw new GeminiApiError(result.error?.message || `Google Gemini returned an error (${response.status}). Please retry.`, 502)
    const outputText = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()
    if (!outputText) throw new GeminiApiError('Google Gemini returned no reflection. Please retry.', 502)

    let output: ReflectionOutput
    try {
      output = JSON.parse(outputText) as ReflectionOutput
    } catch (error) {
      throw new GeminiApiError('Google Gemini returned an unreadable reflection. Please retry.', 502, { cause: error })
    }
    if (typeof output.noticed !== 'string' || !output.noticed.trim()) {
      throw new GeminiApiError('Google Gemini returned an unexpected response. Please retry.', 502)
    }
    return {
      noticed: output.noticed.slice(0, 2000),
      patterns: typeof output.patterns === 'string' ? output.patterns.slice(0, 1200) : '',
      suggestions: Array.isArray(output.suggestions)
        ? output.suggestions.filter((item): item is string => typeof item === 'string').slice(0, 5).map((item) => item.slice(0, 300))
        : [],
    }
  } catch (error) {
    if (error instanceof GeminiApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GeminiApiError('Google Gemini took too long to respond. Please retry.', 504)
    }
    throw new GeminiApiError('Could not reach Google Gemini. Check the server connection and retry.', 502, { cause: error })
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeContext(input: unknown): ReflectionContext {
  if (!input || typeof input !== 'object') throw new GeminiApiError('The reflection request is invalid.', 400)
  const raw = input as Record<string, unknown>
  if (JSON.stringify(input).length > 16_000) throw new GeminiApiError('The reflection request is too large.', 413)

  const profile = raw.profile && typeof raw.profile === 'object' ? raw.profile as Record<string, unknown> : null
  const checkIn = raw.checkIn && typeof raw.checkIn === 'object' ? raw.checkIn as Record<string, unknown> : null
  if (!profile || !checkIn) throw new GeminiApiError('The reflection request is missing profile or check-in details.', 400)
  const requiredValues = ['date', 'condition', 'feeling', 'mood']
  if (requiredValues.some((field) => typeof checkIn[field] !== 'string' || !checkIn[field])) {
    throw new GeminiApiError('The check-in needs a date, condition, feeling, and mood.', 400)
  }

  return {
    profile: {
      skinType: stringValue(profile.skinType, 80),
      concerns: stringArray(profile.concerns, 10, 80),
    },
    checkIn: normalizeEntry(checkIn),
    recentCheckIns: Array.isArray(raw.recentCheckIns) ? raw.recentCheckIns.slice(0, 4).filter(isRecord).map(normalizeEntry) : [],
  }
}

function normalizeEntry(entry: Record<string, unknown>): ReflectionContext['checkIn'] {
  return {
    date: stringValue(entry.date, 40),
    condition: stringValue(entry.condition, 80),
    feeling: stringValue(entry.feeling, 500),
    mood: stringValue(entry.mood, 80),
    productsUsed: Array.isArray(entry.productsUsed)
      ? entry.productsUsed.slice(0, 12).filter(isRecord).map((product) => ({ name: stringValue(product.name, 120), type: stringValue(product.type, 80) }))
      : [],
    note: stringValue(entry.note, 1000),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, maxItems).map((item) => item.slice(0, maxLength)) : []
}
