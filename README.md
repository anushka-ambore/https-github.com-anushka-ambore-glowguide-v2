# GlowGuide AI

GlowGuide AI is a local-first skin reflection diary. Record daily observations, keep a product list, and compare check-ins over time. OpenAI generates supportive reflections from the profile and written check-in details.

> GlowGuide AI is not a medical diagnostic tool. Reflections are supportive observations, not medical advice.

## Run locally

1. Install Node.js (20.19+ or 22.12+).
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
4. Start the development server with `npm run dev`.
5. Create a production build with `npm run build`.

The local Vite server provides `/api/reflection` for development. The browser never receives the OpenAI API key.

## Deploy for a demo

This project is configured for Vercel. Import the project into Vercel and set these server-side environment variables in the Vercel project settings:

- `OPENAI_API_KEY` — your OpenAI API key
- `OPENAI_MODEL` — `gpt-4o-mini`

Deploy with the Vercel dashboard or the Vercel CLI. Do not upload `.env` or put the key in a `VITE_` variable; Vite exposes `VITE_` values in browser bundles. The serverless function only proxies reflection requests and does not store user data.

Create and manage the API key in the OpenAI API platform. ChatGPT subscriptions and API usage are billed separately; a ChatGPT subscription does not include API credits. Configure usage limits before sharing the demo URL.

## OpenAI and privacy

The app sends the profile and written check-in fields, names/types of products used, and up to four previous written check-ins to OpenAI to generate reflections. Photo data and display name are omitted. Profiles, products, entries, reflections, and optional photos are stored in the browser's `localStorage`; no account or persistent app backend is used. The Profile page includes a delete-all-data action for this browser. Deleting browser data does not delete information already sent to OpenAI.

The app does not analyze skin photos, sync to cloud storage, connect users to dermatologists, or provide medical diagnosis or treatment advice.
