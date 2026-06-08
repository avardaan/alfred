# Alfred — Agent Guide

Personal voice assistant powered by [Vapi](https://vapi.ai). Callers reach Alfred by phone; the Bun server handles Vapi webhooks and will eventually run custom tools.

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict, ESM, `.ts` imports with extensions)
- **Voice:** Vapi (`@vapi-ai/server-sdk`) — LLM, TTS, STT configured in `src/vapi/alfred.ts`

## Project layout

```
src/
  index.ts              # Bun.serve entrypoint
  config.ts             # Env var access (no hardcoded secrets)
  routes/webhook.ts     # POST /webhook/vapi handler
  vapi/
    alfred.ts           # Assistant config (prompt, model, voice, transcriber)
    client.ts           # VapiClient factory
  scripts/
    setup-vapi.ts       # Creates assistant + phone number
    test-call.ts        # Outbound test call
```

## Commands

```bash
bun install
bun run dev             # Hot-reload server on PORT (default 3000)
bun run setup:vapi      # Provision assistant + phone number (needs VAPI_API_KEY)
bun run test:call       # Outbound test call (needs VAPI_TEST_PHONE_NUMBER)
```

## Environment

Copy `.env.example` → `.env`. Required for provisioning:

- `VAPI_API_KEY` — from dashboard.vapi.ai
- `VAPI_SERVER_URL` — public URL for webhooks (e.g. ngrok); `/webhook/vapi` is appended automatically

Populated after `setup:vapi`:

- `VAPI_ASSISTANT_ID`
- `VAPI_PHONE_NUMBER_ID`

**Never commit `.env` or any API keys, tokens, or real phone numbers.**

## Conventions

- Keep changes minimal and focused; match existing patterns.
- Read env vars through `src/config.ts`, not `process.env` scattered across files.
- Vapi webhook events that require a response: `assistant-request`, `tool-calls`. All others return `{ received: true }`.
- Assistant personality and voice settings live in `src/vapi/alfred.ts`.
- Scripts in `src/scripts/` are run directly with `bun`, not imported by the server.

## Endpoints

| Method | Path            | Purpose              |
|--------|-----------------|----------------------|
| GET    | `/health`       | Health check         |
| POST   | `/webhook/vapi` | Vapi server messages |

## Current status

- [x] Bun server bootstrapped
- [x] Vapi webhook handler
- [ ] Run `setup:vapi` with real credentials
- [ ] Custom tools for Alfred (tool-calls handler returns placeholders)
- [ ] Test inbound/outbound calls

## Docs

- Vapi docs: https://docs.vapi.ai
- Vapi markdown index: https://docs.vapi.ai/llms.txt
