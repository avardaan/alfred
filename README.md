# Alfred

Personal voice assistant powered by [Vapi](https://vapi.ai).

## Setup

```bash
bun install
cp .env.example .env
```

Fill in `.env` with your Vapi API key. **Never commit `.env`.**

## Run

```bash
bun run dev
```

Health check: `GET /health`  
Vapi webhook: `POST /webhook/vapi`

## Vapi provisioning

1. Add `VAPI_API_KEY` to `.env`
2. For webhooks, expose your local server (e.g. ngrok) and set `VAPI_SERVER_URL`
3. Run:

```bash
bun run setup:vapi
```

4. Copy the printed `VAPI_ASSISTANT_ID` and `VAPI_PHONE_NUMBER_ID` into `.env`

## Test calls

```bash
# inbound: call the phone number printed by setup:vapi
# outbound:
bun run test:call
```

Requires `VAPI_TEST_PHONE_NUMBER` in `.env` (E.164 format).
