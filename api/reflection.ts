import { generateGroqReflection, GroqApiError } from '../server/groq.js'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface VercelResponse {
  statusCode: number
  setHeader(name: string, value: string): void
  end(data?: string): void
}

interface NodeEnvironment {
  process?: { env?: Record<string, string | undefined> }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  response.setHeader('Content-Type', 'application/json')
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    send(response, 405, { error: 'Only POST requests are supported.' })
    return
  }

  const origin = request.headers.origin
  const host = request.headers.host
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        send(response, 403, { error: 'Cross-origin reflection requests are not allowed.' })
        return
      }
    } catch {
      send(response, 403, { error: 'Cross-origin reflection requests are not allowed.' })
      return
    }
  }

  try {
    const input = typeof request.body === 'string' ? JSON.parse(request.body) as unknown : request.body
    const env = (globalThis as typeof globalThis & NodeEnvironment).process?.env ?? {}
    const result = await generateGroqReflection(input, {
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
    })
    send(response, 200, result)
  } catch (error) {
    const statusCode = error instanceof GroqApiError ? error.statusCode : error instanceof SyntaxError ? 400 : 500
    const message = error instanceof Error ? error.message : 'Could not generate the reflection.'
    send(response, statusCode, { error: message })
  }
}

function send(response: VercelResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode
  response.end(JSON.stringify(body))
}
