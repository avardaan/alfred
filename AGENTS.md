# Alfred — Agent Guide

Personal voice assistant powered by [Vapi](https://vapi.ai). Vapi runs the voice pipeline (STT, LLM, TTS); this Bun server handles webhooks and executes custom tools.

## Prerequisites

- [Bun](https://bun.sh) (runtime + package manager)
- A [Vapi](https://dashboard.vapi.ai) account and API key

## Quick start

Fresh clone from scratch. If you're resuming work, jump in at whichever step you already have done.

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in at least `VAPI_API_KEY` and `VAPI_SERVER_URL`. See `.env.example` for what each variable does.

3. **Provision Vapi resources**

   ```bash
   bun run setup:vapi
   ```

   Creates an assistant and phone number. Copy the printed `VAPI_ASSISTANT_ID` and `VAPI_PHONE_NUMBER_ID` into `.env`.

   **Optional — use your own Twilio number** instead of the Vapi-provisioned one (avoids Vapi's daily outbound-call limit). Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (use **Live**, not Test, credentials), and `TWILIO_PHONE_NUMBER` (E.164) in `.env`, then:

   ```bash
   bun run import:twilio
   ```

   Imports the number into Vapi, links it to your existing assistant, and prints a new `VAPI_PHONE_NUMBER_ID` — copy it into `.env`. Trial Twilio accounts can only call numbers verified under *Phone Numbers → Verified Caller IDs*.

4. **Start the server**

   ```bash
   bun run dev
   ```

5. **Smoke check** (before placing calls)

   ```bash
   curl http://localhost:3000/health          # local: {"status":"ok"}
   curl https://<your-public-url>/health       # public: must also return 200
   ```

   `VAPI_SERVER_URL` must be a public URL Vapi can reach (Codespaces forwarded port, ngrok, etc.). The server appends `/webhook/vapi` automatically — do not include that path in the env var.

6. **Place an outbound test call**

   ```bash
   bun run test:call
   ```

   Requires `VAPI_TEST_PHONE_NUMBER` in `.env` (E.164 format).

After changing assistant config (`src/vapi/*`), push to Vapi:

```bash
bun run sync:assistant
```

**Never commit `.env` or any API keys, tokens, or real phone numbers.**

## Deploy to Render

Alfred runs on Render as a Docker web service. Vapi webhooks hit `https://<your-service>.onrender.com/webhook/vapi`.

**Render project:** [alfred (prj-d8jr6a42m8qs739eed9g)](https://dashboard.render.com/project/prj-d8jr6a42m8qs739eed9g)

The Blueprint in `render.yaml` targets the `alfred` project, `production` environment. If your Dashboard project uses a different name, rename the `projects[].name` field to match before applying.

### First-time setup

1. **Authenticate Render CLI** (optional, for validation and logs)

   ```bash
   render login
   render blueprints validate
   ```

2. **Apply the Blueprint** in your Render project

   Open the project, then create a Blueprint from this repo:

   ```
   https://dashboard.render.com/project/prj-d8jr6a42m8qs739eed9g/blueprint/new?repo=https://github.com/avardaan/alfred
   ```

   Or: Project → **New** → **Blueprint** → select `avardaan/alfred` → branch `main`.

3. **Fill secrets** when prompted (also editable later under the service → Environment)

   | Variable | Required on Render | Notes |
   |----------|-------------------|-------|
   | `VAPI_API_KEY` | No (runtime) | Needed for local scripts |
   | `VAPI_ASSISTANT_ID` | **Yes** | Used by `assistant-request` webhook |
   | `VAPI_PHONE_NUMBER_ID` | No | Only for `test:call` locally |

   Render sets `PORT` automatically. Do **not** set `VAPI_SERVER_URL` on Render — it is only used by local setup/sync scripts.

4. **Wait for deploy**, then smoke check

   ```bash
   curl https://alfred.onrender.com/health
   ```

   Use your actual `*.onrender.com` hostname from the Dashboard.

5. **Point Vapi at Render** (run locally)

   ```bash
   # .env — use your Render URL, no /webhook/vapi suffix
   VAPI_SERVER_URL=https://alfred.onrender.com
   bun run sync:assistant
   ```

6. **Test**

   ```bash
   bun run test:call
   ```

   Or call your Twilio/Vapi number inbound.

### After code changes

Push to `main` — Render auto-deploys (`autoDeployTrigger: commit`). After changing `src/vapi/*`, also run `bun run sync:assistant` locally.

### Free tier note

Free web services spin down after ~15 minutes idle. Vapi webhooks may hit a cold start. For reliable voice calls, upgrade the service to **Starter** in the Dashboard or set `plan: starter` in `render.yaml` and re-sync the Blueprint.

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict, ESM, `.ts` imports with extensions)
- **Voice:** Vapi (`@vapi-ai/server-sdk`) — assistant config in `src/vapi/alfred.ts`

## Adding a tool

1. **Handler** — implement in `src/tools/` and register in `src/tools/index.ts`
2. **Vapi schema** — add the function definition to `src/vapi/tools.ts`
3. **Prompt** — update `ALFRED_SYSTEM_PROMPT` in `src/vapi/alfred.ts` so the assistant knows when to use it
4. **Deploy** — `bun run sync:assistant`

## MCP (local dev tooling)

Two [MCP](https://modelcontextprotocol.io) servers help when building on this project. They are **not part of the application** — configure them in whatever agent/IDE tool you use. MCP config is gitignored and not committed.

| Server | Type | Purpose |
|--------|------|---------|
| `vapi-docs` | Remote HTTP | Search Vapi documentation (`searchDocs`) |
| `vapi` | Local stdio | Manage assistants, calls, and phone numbers via API |

**`vapi-docs`** — remote endpoint, no auth:

```
https://docs.vapi.ai/_mcp/server
```

**`vapi`** — local process via npx; needs `VAPI_TOKEN` in `.env` (see `.env.example`):

```
npx -y @vapi-ai/mcp-server
```

Point the server's env at your project `.env` file (exact config key varies by tool — see [Vapi MCP docs](https://docs.vapi.ai/sdk/mcp-server)).

## Conventions

- Read env vars through `src/config.ts`, not scattered `process.env` calls.
- Vapi webhook events that require a response: `assistant-request`, `tool-calls`. All others return `{ received: true }`.
- Vapi sends tool calls as `function.name` + `function.arguments` (object or JSON string) — parse via `src/routes/parse-tool-call.ts`.
- Tool handlers return plain strings; the webhook wraps them in `{ results: [{ toolCallId, result }] }`.
- Run `bun run sync:assistant` after changing `src/vapi/alfred.ts` or `src/vapi/tools.ts`.

## Known issues

- Outbound calls to some numbers intermittently capture no customer audio (STT hears nothing). Inbound calls and calls to other numbers have worked. Tabled for now.

## Docs

- Vapi docs: https://docs.vapi.ai
- Vapi markdown index: https://docs.vapi.ai/llms.txt (append `.md` to any docs URL for markdown)
- Vapi MCP server: https://docs.vapi.ai/sdk/mcp-server
- Vapi docs MCP endpoint: https://docs.vapi.ai/_mcp/server
