# solarpilled.com

Tools and data for smart homeowners going solar. No hype, just numbers.

## Stack

- **Astro** — Static site generator
- **Cloudflare Pages** — Hosting & edge
- **Cloudflare D1** — Subscriber database
- **Cloudflare KV** — Response caching

## Development

```bash
npm install
npm run dev
```

## Deployment

Pushes to `main` auto-deploy via Cloudflare Pages.
Branch pushes get preview deployments.
