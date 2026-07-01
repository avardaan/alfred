# Alfred — Agent Guide

Personal voice assistant powered by [ElevenAgents](https://elevenlabs.io/docs/eleven-agents/overview). ElevenLabs runs the voice pipeline (STT, LLM, TTS); this Bun server personalizes inbound calls, executes custom tools, and places outbound calls for autonomous tasks.

## Prerequisites

- [Bun](https://bun.sh) (runtime + package manager)
- [PostgreSQL](https://www.postgresql.org/) 13+ (Alfred uses Postgres for user storage)
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

   Fill in at least `DATABASE_URL`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_SERVER_URL`. See `.env.example` for what each variable does.

   Apply database migrations:

   ```bash
   bun run db:migrate
   ```

3. **Provision ElevenLabs resources**

   ```bash
   bun run setup
   ```

   Creates the Alfred agent, Alfred Outbound agent, and three webhook tools (`get_weather`, `create_task`, `submit_task_result`). Copy printed IDs into `.env`.

4. **Import Twilio number** (if using your own number)

   Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` (E.164) in `.env`, then:

   ```bash
   bun run import:twilio
   ```

   Re-run after ElevenLabs adds SMS support or if inbound texts are not replied to — the script re-imports the number and sets Twilio `sms_url` to ElevenLabs. Inbound SMS uses the same assigned Alfred agent as voice.

5. **Sync ElevenLabs URLs** (after deploy or URL change):

   ```bash
   bun run sync:agent
   ```

   Updates init webhook, weather tool, create_task tool, submit_task_result tool, and both agent configs (inbound + outbound) from `ELEVENLABS_SERVER_URL`.

6. **Start the server**

   ```bash
   bun run dev
   ```

7. **Smoke check**

   ```bash
   curl http://localhost:3000/health
   curl https://<your-public-url>/health
   ```

   `ELEVENLABS_SERVER_URL` must be a public URL ElevenLabs can reach (Codespaces forwarded port, ngrok, a VPS, etc.). Do not include path suffixes — the app uses `/webhook/elevenlabs/init` and `/tools/get_weather`.

8. **Place an outbound test call**

   ```bash
   bun run test:call
   ```

   Requires `ELEVENLABS_TEST_PHONE_NUMBER` in `.env` (E.164 format).

After changing persona or voice stack (`src/assistant/*`, `src/elevenlabs/*`) or init webhook, publish to ElevenLabs Main:

```bash
bun run sync:agent
```

`sync:agent` commits a new version on Main (no lingering draft) and updates init webhook, all webhook tools, and both agent configs (inbound + outbound) from `ELEVENLABS_SERVER_URL`.

Inbound calls and SMS personalize via `/webhook/elevenlabs/init` when ElevenLabs sends `caller_id` (configured on the agent by `sync:agent`). Outbound `test:call` passes the same lookup via `conversationInitiationClientData`.

**Never commit `.env` or any API keys, tokens, or real phone numbers.**

## Deploy (Hetzner VPS)

Alfred runs on a Hetzner VPS behind [Caddy](https://caddyserver.com), which terminates TLS and reverse-proxies to the Bun server on `127.0.0.1:3000`. ElevenLabs hits:

| Route | Purpose |
|-------|--------|
| `/webhook/elevenlabs/init` | Inbound call initiation — lookup caller in Postgres, personalize greeting |
| `/tools/get_weather` | Webhook tool → `src/tools/weather.ts` |
| `/tools/create_task` | Webhook tool — creates an outbound task (e.g. call a business and ask hours) |
| `/tools/submit_task_result` | Webhook tool — outbound agent reports the result of a task |

**Host:** Hetzner VPS `62.238.47.91` (SSH alias `alfred`, user `vardaan`). Public URL `https://62-238-47-91.sslip.io` — the [sslip.io](https://sslip.io) hostname maps to the IP so Let's Encrypt can issue a cert for an otherwise bare-IP host. The Hetzner firewall allows ports 80 and 443.

The running server needs `DATABASE_URL` (Postgres); tool and webhook routes are otherwise unauthenticated. Keep API keys in local `.env` for scripts only.

### Process (systemd)

The server runs as a systemd unit at `/etc/systemd/system/alfred.service`: `bun --watch src/index.ts` as `vardaan`, `EnvironmentFile=` the repo `.env`, `Restart=always`, enabled at boot. `--watch` hot-reloads on file changes, so deploying is just updating code on the box:

```bash
ssh alfred
cd ~/projects/alfred && git pull   # or edit in place; --watch reloads
```

Operate it with:

```bash
systemctl status alfred
journalctl -u alfred -f
sudo systemctl restart alfred
```

### TLS / reverse proxy (Caddy)

Caddy runs as a systemd service and auto-provisions/renews the Let's Encrypt certificate. Config at `/etc/caddy/Caddyfile`:

```caddyfile
62-238-47-91.sslip.io {
    reverse_proxy 127.0.0.1:3000
}
```

Reload after edits with `sudo systemctl reload caddy`.

### Database (PostgreSQL)

PostgreSQL 18 runs on the VPS, bound to `127.0.0.1:5432` (not exposed publicly). The `alfred` role owns the `alfred` database; `DATABASE_URL` in `.env` points the app at it. Schema is defined in `src/db/schema.ts` (Drizzle ORM); migrations live in `drizzle/` and are applied with `bun run db:migrate`.

Back up with `pg_dump`:

```bash
sudo -u postgres pg_dump alfred | gzip > alfred_$(date +%F).sql.gz
```

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict, ESM, `.ts` imports with extensions)
- **Voice:** ElevenAgents — `@elevenlabs/elevenlabs-js`, configured in `src/elevenlabs/*`
- **Persona:** `src/assistant/alfred.ts` (inbound prompt, greeting, voice ID); `src/assistant/alfred-outbound.ts` (outbound task agent prompt, greeting, voice ID)
- **Database:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) (postgres-js driver), schema in `src/db/schema.ts`

### Layout

| Path | Role |
|------|------|
| `src/assistant/` | Persona text and voice IDs (inbound `alfred.ts`, outbound `alfred-outbound.ts`) |
| `src/elevenlabs/voice-stack.ts` | LLM, STT (ASR), TTS, turn-taking, call limits |
| `src/elevenlabs/overrides.ts` | Security override permissions for the agent |
| `src/elevenlabs/agent-sync.ts` | Publish agent updates to ElevenLabs Main branch |
| `src/elevenlabs/alfred.ts` | Assembles inbound agent config for the API |
| `src/elevenlabs/alfred-outbound.ts` | Assembles outbound agent config (longer turn timeout, `submit_task_result` tool) |
| `src/elevenlabs/outbound-call.ts` | Places outbound calls via the ElevenLabs Batch Calls API |
| `src/elevenlabs/tools.ts` | Webhook tool definitions synced to ElevenLabs |
| `src/tools/` | Tool implementations (weather, create_task, submit_task_result) |
| `src/routes/` | HTTP handlers (`/webhook/elevenlabs/init`, `/tools/*`) |
| `src/db/` | Drizzle schema (`schema.ts`), client (`client.ts`), user lookup (`users.ts`), task helpers (`tasks.ts`) |
| `drizzle.config.ts` | Drizzle Kit config (schema path, migrations folder, DB URL) |
| `drizzle/` | Generated SQL migrations (applied with `bun run db:migrate`) |
| `src/scripts/` | `setup`, `sync:agent`, `import:twilio`, `test:call`, `db:generate`, `db:migrate`, `db:push` |

ElevenLabs config is managed with TypeScript + `bun run setup` / `bun run sync:agent`, not the ElevenLabs CLI.

## Autonomous tasks (outbound)

Alfred can place outbound calls to third parties on the user's behalf. The flow:

1. User asks Alfred (voice or WhatsApp) to call a business and ask their hours.
2. The inbound agent calls the `create_task` tool → server creates a `tasks` row and places an outbound call via the ElevenLabs Batch Calls API (`src/elevenlabs/outbound-call.ts`).
3. The **Alfred Outbound** agent (second ElevenLabs agent, `src/elevenlabs/alfred-outbound.ts`) answers, asks for hours, and calls the `submit_task_result` tool with the result.
4. The server marks the task complete and places a notification call back to the user with the result.

A 5-minute in-process timeout (`COMPLETION_TIMEOUT_MS` in `src/tools/create-task.ts`) catches calls that end without `submit_task_result` — it polls the conversation status and marks the task as failed + notifies the user.

The `scheduled_for` column on `tasks` exists for future scheduled tasks but is unused in v1 (on-demand only). No worker process reads it yet.

## Adding a tool

1. **Handler** — implement in `src/tools/` and register in `src/tools/index.ts`
2. **ElevenLabs schema** — add config in `src/elevenlabs/tools.ts` and wire the tool ID in `src/elevenlabs/alfred.ts`
3. **Prompt** — update `ALFRED_SYSTEM_PROMPT` in `src/assistant/alfred.ts`
4. **Route** — add a POST handler in `src/index.ts` if the tool needs a dedicated webhook path
5. **Deploy** — `bun run sync:agent` for ElevenLabs; update code on the VPS for new routes (see Deploy section)

## Conventions

- Read env vars through `src/config.ts`, not scattered `process.env` calls.
- ElevenLabs webhook tools POST `requestBodySchema` fields directly (e.g. `{ "location": "..." }`), not always wrapped in `parameters`.
- Tool handlers return plain strings; the webhook responds with `{ result: "..." }`.
- Run `bun run sync:agent` after changing `src/assistant/*` or `src/elevenlabs/*`.
- Run `bun run db:generate` then `bun run db:migrate` after changing `src/db/schema.ts`.
- `findUserByPhone` is async (queries Postgres); consumers must `await` it.
- Task helpers (`createTask`, `updateTaskStatus`, `createAttempt`, etc.) are in `src/db/tasks.ts` and are async.
- The outbound agent has its own persona in `src/assistant/alfred-outbound.ts` and config in `src/elevenlabs/alfred-outbound.ts`.

## Docs

- ElevenLabs index: https://elevenlabs.io/docs/llms.txt
- Agents overview: https://elevenlabs.io/docs/eleven-agents/overview
- Server tools: https://elevenlabs.io/docs/eleven-agents/customization/tools/server-tools
