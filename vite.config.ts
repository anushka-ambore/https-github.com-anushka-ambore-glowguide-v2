import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin, defineConfig } from 'vite'
import { generateGroqReflection, GroqApiError } from './server/groq.js'

function localReflectionApi(): Plugin {
  return {
    name: 'glowguide-local-reflection-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      server.middlewares.use('/api/reflection', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.setHeader('Allow', 'POST')
          response.end(JSON.stringify({ error: 'Only POST requests are supported.' }))
          return
        }

        try {
          const chunks: Buffer[] = []
          let bytes = 0
          for await (const chunk of request) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            bytes += buffer.length
            if (bytes > 16_000) throw new GroqApiError('The reflection request is too large.', 413)
            chunks.push(buffer)
          }
          const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          const result = await generateGroqReflection(input, {
            apiKey: env.GROQ_API_KEY,
            model: env.GROQ_MODEL,
          })
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(result))
        } catch (error) {
          const statusCode = error instanceof GroqApiError ? error.statusCode : error instanceof SyntaxError ? 400 : 500
          const message = error instanceof Error ? error.message : 'Could not generate the reflection.'
          response.statusCode = statusCode
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localReflectionApi()],
})
