# Alfred — Agent Guide

Personal voice assistant powered by [Vapi](https://vapi.ai). Callers reach Alfred by phone; the Bun server handles Vapi webhooks and runs custom tools.

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict, ESM, `.ts` imports with extensions)
- **Voice:** Vapi (`@vapi-ai/server-sdk`) — LLM, TTS, STT configured in `src/vapi/alfred.ts`

## Project layout

```
src/
  index.ts                  # Bun.serve entrypoint
  config.ts                 # Env var access (no hardcoded secrets)
  routes/
    webhook.ts              # POST /webhook/vapi handler
    parse-tool-call.ts      # Normalizes Vapi tool-call payloads
  tools/
    index.ts                # Tool dispatcher
    weather.ts              # get_weather (wttr.in)
  vapi/
    alfred.ts               # Assistant config (prompt, model, voice, tools)
    tools.ts                # Vapi tool definitions
    client.ts               # VapiClient factory
  scripts/
    setup-vapi.ts           # Creates assistant + phone number
    sync-assistant.ts       # Pushes assistant config changes to Vapi
    test-call.ts            # Outbound test call
```

## Commands

```bash
bun install
bun run dev               # Hot-reload server on PORT (default 3000)
bun run setup:vapi        # Provision assistant + phone number (needs VAPI_API_KEY)
bun run sync:assistant    # Update live assistant after changing src/vapi/*
bun run test:call         # Outbound test call (needs VAPI_TEST_PHONE_NUMBER)
```

## Environment

Copy `.env.example` → `.env`. Required for provisioning:

- `VAPI_API_KEY` — from dashboard.vapi.ai
- `VAPI_SERVER_URL` — public URL for webhooks; `/webhook/vapi` is appended automatically

Populated after `setup:vapi`:

- `VAPI_ASSISTANT_ID`
- `VAPI_PHONE_NUMBER_ID`

Optional:

- `VAPI_TEST_PHONE_NUMBER` — E.164 format for outbound test calls
- `VAPI_AREA_CODE` — preferred US area code for Vapi phone number

**Never commit `.env` or any API keys, tokens, or real phone numbers.**

## Conventions

- Keep changes minimal and focused; match existing patterns.
- Read env vars through `src/config.ts`, not `process.env` scattered across files.
- Vapi webhook events that require a response: `assistant-request`, `tool-calls`. All others return `{ received: true }`.
- Vapi sends tool calls as `function.name` + `function.arguments` (object or JSON string) — parse via `parse-tool-call.ts`.
- Tool handlers return plain strings; webhook wraps them in `{ results: [{ toolCallId, result }] }`.
- Assistant personality, greeting, and tools live in `src/vapi/`. Run `bun run sync:assistant` after changes.
- Scripts in `src/scripts/` are run directly with `bun`, not imported by the server.

## Endpoints

| Method | Path            | Purpose                    |
|--------|-----------------|----------------------------|
| GET    | `/`             | Plain-text greeting        |
| GET    | `/health`       | Health check               |
| POST   | `/webhook/vapi` | Vapi server messages       |

## Current status

- [x] Bun server bootstrapped
- [x] Vapi assistant + phone number provisioned
- [x] Webhook handler (tool-calls, transcripts, status)
- [x] `get_weather` tool
- [x] Inbound + outbound test calls
- [ ] Messaging channel (WhatsApp / SMS via Twilio)
- [ ] Transactional tools (reservations, appointment calls on user's behalf)
- [ ] Call logging / transcript persistence

## Docs

- Vapi docs: https://docs.vapi.ai
- Vapi markdown index: https://docs.vapi.ai/llms.txt
