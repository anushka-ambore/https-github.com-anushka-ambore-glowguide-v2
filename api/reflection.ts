import type { IncomingMessage, ServerResponse } from 'node:http'
import { generateGeminiReflection, GeminiApiError } from '../server/gemini.ts'

interface VercelRequest extends IncomingMessage {
  body?: unknown
}

export default async function handler(request: VercelRequest, response: ServerResponse): Promise<void> {
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
    const input = request.body === undefined
      ? await readJsonBody(request)
      : typeof request.body === 'string'
        ? JSON.parse(request.body) as unknown
        : request.body
    const result = await generateGeminiReflection(input, {
      apiKey: process.env.GEMINI_API_KEY,
      endpoint: process.env.GEMINI_API_ENDPOINT,
      model: process.env.GEMINI_MODEL,
    })
    send(response, 200, result)
  } catch (error) {
    const statusCode = error instanceof GeminiApiError ? error.statusCode : error instanceof SyntaxError ? 400 : 500
    const message = error instanceof Error ? error.message : 'Could not generate the reflection.'
    send(response, statusCode, { error: message })
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > 16_000) throw new GeminiApiError('The reflection request is too large.', 413)
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function send(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode
  response.end(JSON.stringify(body))
}
