# Fieldnotes AI

A simple AI chat app built with Cloudflare Workers.

## Features

- Chat with Llama 3.3 through Cloudflare Workers AI.
- Keep conversation history in a Durable Object for each browser session.
- Start a new conversation without losing other sessions.

## Requirements

- Node.js and npm
- A Cloudflare account with Workers AI access

Workers AI uses the Cloudflare `AI` binding, so no model API key is needed. Wrangler must be logged in before using the model locally.

## Run locally

```sh
npm install
npx wrangler login
npm run dev
```

Open the local URL printed by Wrangler. Requests to Workers AI use your Cloudflare account and may incur charges.

## Deploy

```sh
npx wrangler login
npm run deploy
```

The Worker serves the chat interface at `/`.

## API

- `POST /chat?session=ID` accepts JSON `{ "message": "..." }` and returns the assistant reply and conversation history.
- `GET /history?session=ID` returns the conversation history.

If `session` is omitted, the API uses `default`. The chat page creates a session ID for the browser tab and starts a fresh session when you select **New chat**.