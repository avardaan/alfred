# Alfred — Agent Guide

Personal voice assistant powered by [ElevenAgents](https://elevenlabs.io/docs/eleven-agents/overview). ElevenLabs runs the voice pipeline (STT, LLM, TTS); this Bun server handles post-call webhooks and executes custom tools.

## Prerequisites

- [Bun](https://bun.sh) (runtime + package manager)
- An [ElevenLabs](https://elevenlabs.io) account and API key with ConvAI scopes

## Quick start

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in at least `ELEVENLABS_API_KEY` and `ELEVENLABS_SERVER_URL`. See `.env.example` for what each variable does.

3. **Provision ElevenLabs resources**

   ```bash
   bun run setup
   ```

   Creates the Alfred agent and `get_weather` webhook tool. Copy printed IDs into `.env`.

4. **Import Twilio number** (if using your own number)

   Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` (E.164) in `.env`, then:

   ```bash
   bun run import:twilio
   ```

5. **Set post-call webhook** in ElevenLabs Dashboard → Agents → Webhooks:

   ```
   https://<your-public-url>/webhook/elevenlabs
   ```

6. **Start the server**

   ```bash
   bun run dev
   ```

7. **Smoke check**

   ```bash
   curl http://localhost:3000/health
   curl https://<your-public-url>/health
   ```

   `ELEVENLABS_SERVER_URL` must be a public URL ElevenLabs can reach (Codespaces forwarded port, ngrok, Render, etc.). Do not include path suffixes — the app uses `/webhook/elevenlabs` and `/tools/get_weather`.

8. **Place an outbound test call**

   ```bash
   bun run test:call
   ```

   Requires `ELEVENLABS_TEST_PHONE_NUMBER` in `.env` (E.164 format).

After changing persona or voice stack (`src/assistant/*`, `src/elevenlabs/*`):

```bash
bun run sync:agent
```

**Never commit `.env` or any API keys, tokens, or real phone numbers.**

## Deploy to Render

Alfred runs on Render as a Docker web service. ElevenLabs hits:

| Route | Purpose |
|-------|---------|
| `/webhook/elevenlabs` | Post-call transcription webhooks |
| `/tools/get_weather` | Webhook tool → `src/tools/weather.ts` |

**Render project:** [alfred (prj-d8jr6a42m8qs739eed9g)](https://dashboard.render.com/project/prj-d8jr6a42m8qs739eed9g)

The running server needs no secrets on Render — tool and webhook routes are unauthenticated. Keep API keys in local `.env` for scripts only.

Push to `main` — Render auto-deploys (`autoDeployTrigger: commit` in `render.yaml`).

### Free tier note

Free web services spin down after ~15 minutes idle. Inbound calls may hit a cold start. For reliable voice calls, upgrade to **Starter** in the Dashboard or set `plan: starter` in `render.yaml`.

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict, ESM, `.ts` imports with extensions)
- **Voice:** ElevenAgents — `@elevenlabs/elevenlabs-js`, configured in `src/elevenlabs/*`
- **Persona:** `src/assistant/alfred.ts` (prompt, greeting, voice ID)

### Layout

| Path | Role |
|------|------|
| `src/assistant/` | Persona text and voice ID (source of truth for prompts) |
| `src/elevenlabs/voice-stack.ts` | LLM, STT (ASR), TTS, turn-taking, call limits |
| `src/elevenlabs/alfred.ts` | Assembles full agent config for the API |
| `src/elevenlabs/tools.ts` | Webhook tool definitions synced to ElevenLabs |
| `src/tools/` | Tool implementations (weather, etc.) |
| `src/routes/` | HTTP handlers (`/webhook/elevenlabs`, `/tools/*`) |
| `src/scripts/` | `setup`, `sync:agent`, `import:twilio`, `test:call` |

ElevenLabs config is managed with TypeScript + `bun run setup` / `bun run sync:agent`, not the ElevenLabs CLI.

## Adding a tool

1. **Handler** — implement in `src/tools/` and register in `src/tools/index.ts`
2. **ElevenLabs schema** — add config in `src/elevenlabs/tools.ts` and wire the tool ID in `src/elevenlabs/alfred.ts`
3. **Prompt** — update `ALFRED_SYSTEM_PROMPT` in `src/assistant/alfred.ts`
4. **Route** — add a POST handler in `src/index.ts` if the tool needs a dedicated webhook path
5. **Deploy** — `bun run sync:agent` for ElevenLabs; push code to Render for new routes

## Conventions

- Read env vars through `src/config.ts`, not scattered `process.env` calls.
- ElevenLabs webhook tools POST `requestBodySchema` fields directly (e.g. `{ "location": "..." }`), not always wrapped in `parameters`.
- Tool handlers return plain strings; the webhook responds with `{ result: "..." }`.
- Run `bun run sync:agent` after changing `src/assistant/alfred.ts` or `src/elevenlabs/*`.

## Docs

- ElevenLabs index: https://elevenlabs.io/docs/llms.txt
- Agents overview: https://elevenlabs.io/docs/eleven-agents/overview
- Server tools: https://elevenlabs.io/docs/eleven-agents/customization/tools/server-tools
