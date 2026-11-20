export interface OpenAISettings {
  apiKey?: string
  model?: string
}

export class OpenAIApiError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number, options?: ErrorOptions) {
    super(message, options)
    this.name = 'OpenAIApiError'
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

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string | null } }>
  error?: { message?: string }
}

interface ReflectionOutput {
  noticed?: string
  patterns?: string
  suggestions?: string[]
}

export interface OpenAIReflectionResult {
  noticed: string
  patterns: string
  suggestions: string[]
}

export async function generateOpenAIReflection(input: unknown, settings: OpenAISettings): Promise<OpenAIReflectionResult> {
  const apiKey = settings.apiKey
  if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY') {
    throw new OpenAIApiError('OpenAI is not configured on the server. Add OPENAI_API_KEY, then retry.', 503)
  }

  const reflectionContext = normalizeContext(input)
  const model = settings.model || 'gpt-4o-mini'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are GlowGuide, a kind and non-medical skin reflection coach. Based only on the user’s recorded observations, return a JSON object with three fields: noticed (a warm observation), patterns (a cautious possible pattern or an empty string), and suggestions (an array of gentle everyday habit ideas). Never diagnose, make medical claims, recommend treatments, or claim a product caused a change. Clearly avoid certainty. Keep suggestions simple and supportive.',
          },
          { role: 'user', content: JSON.stringify(reflectionContext) },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 512,
      }),
      signal: controller.signal,
    })

    const result = await response.json() as OpenAIResponse
    if (!response.ok) {
      if (response.status === 429) {
        throw new OpenAIApiError('OpenAI API usage limit reached. Check your API usage and billing, then retry.', 429)
      }
      throw new OpenAIApiError(result.error?.message || `OpenAI returned an error (${response.status}). Please retry.`, 502)
    }

    const outputText = result.choices?.[0]?.message?.content?.trim()
    if (!outputText) throw new OpenAIApiError('OpenAI returned no reflection. Please retry.', 502)

    let output: ReflectionOutput
    try {
      output = JSON.parse(outputText) as ReflectionOutput
    } catch (error) {
      throw new OpenAIApiError('OpenAI returned an unreadable reflection. Please retry.', 502, { cause: error })
    }
    if (typeof output.noticed !== 'string' || !output.noticed.trim()) {
      throw new OpenAIApiError('OpenAI returned an unexpected response. Please retry.', 502)
    }
    return {
      noticed: output.noticed.slice(0, 2000),
      patterns: typeof output.patterns === 'string' ? output.patterns.slice(0, 1200) : '',
      suggestions: Array.isArray(output.suggestions)
        ? output.suggestions.filter((item): item is string => typeof item === 'string').slice(0, 5).map((item) => item.slice(0, 300))
        : [],
    }
  } catch (error) {
    if (error instanceof OpenAIApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenAIApiError('OpenAI took too long to respond. Please retry.', 504)
    }
    throw new OpenAIApiError('Could not reach OpenAI. Check the server connection and retry.', 502, { cause: error })
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeContext(input: unknown): ReflectionContext {
  if (!input || typeof input !== 'object') throw new OpenAIApiError('The reflection request is invalid.', 400)
  const raw = input as Record<string, unknown>
  if (JSON.stringify(input).length > 16_000) throw new OpenAIApiError('The reflection request is too large.', 413)

  const profile = raw.profile && typeof raw.profile === 'object' ? raw.profile as Record<string, unknown> : null
  const checkIn = raw.checkIn && typeof raw.checkIn === 'object' ? raw.checkIn as Record<string, unknown> : null
  if (!profile || !checkIn) throw new OpenAIApiError('The reflection request is missing profile or check-in details.', 400)
  const requiredValues = ['date', 'condition', 'feeling', 'mood']
  if (requiredValues.some((field) => typeof checkIn[field] !== 'string' || !checkIn[field])) {
    throw new OpenAIApiError('The check-in needs a date, condition, feeling, and mood.', 400)
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
