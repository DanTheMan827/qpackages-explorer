# QPackages Explorer

A responsive React + TypeScript interface for browsing `qpackages.com`. It can run as a normal Vite static build or as a combined Cloudflare Worker + Static Assets deployment.

## Automatic API routing

Every API request goes through `src/lib/api.ts`, which selects the transport at runtime/build time:

| Situation | Request route |
| --- | --- |
| The page hostname is exactly `qpackages.com` | Directly request `https://qpackages.com/...` |
| Running with `npm run dev` / Vite development | Same-origin Vite middleware at `/corsbypass/?url=...` |
| Built by Wrangler through `[build]` | Same-origin deployed Worker at `/corsbypass/?url=...` |
| Ordinary `npm run build` hosted elsewhere | Configurable public CORS proxy |

The `qpackages.com` hostname check takes priority over every proxy mode. This means a Wrangler build hosted directly at `qpackages.com` still uses direct requests.

The Wrangler build mode is set by `.env.wrangler`, which is loaded only by:

```bash
vite build --mode wrangler
```

Wrangler invokes that command automatically through the `[build]` section in `wrangler.toml`.

## Worker proxy endpoint

The Worker exposes:

```text
/corsbypass/?url=https%3A%2F%2Fqpackages.com%2Fplaylistcore%3Flimit%3D0
```

Both the Vite development middleware and Cloudflare Worker enforce the same security boundary:

- Only `GET`, `HEAD`, and `OPTIONS` are accepted.
- Only the exact hostname `qpackages.com` is accepted.
- Only HTTPS is accepted.
- Credentials and nonstandard ports are rejected.
- Redirects are followed manually and every redirect destination is revalidated.
- Subdomains and lookalike domains are rejected.

Examples that are rejected:

```text
https://subdomain.qpackages.com/
https://qpackages.com.example.com/
https://evilqpackages.com/
http://qpackages.com/
https://qpackages.com:8443/
https://qpackages.com@evil.example/
```

## Features

- Searchable package navigation and responsive mobile drawer
- Version selector with shareable `?package=...&version=...` URLs
- Package overview, dependency, workspace, script, compile-option, and artifact views
- Raw JSON tab with line numbers, syntax highlighting, and copy support
- Browser-controlled dark/light mode, with dark as the fallback
- Automatic direct, Vite-proxy, Worker-proxy, or public-proxy selection
- Defensive TypeScript models that preserve unknown future fields
- Full-catalog schema audit utility

## Install

```bash
npm install
```

## Vite development

```bash
npm run dev
```

Open `http://localhost:5173`.

`import.meta.env.DEV` selects the Vite middleware at `/corsbypass/`. The development proxy is implemented in `vite.config.ts` and only allows `https://qpackages.com`.

## Ordinary static build

```bash
npm run build
```

This creates `dist/` without assuming a Worker will host it. When hosted somewhere other than `qpackages.com`, the browser uses the public proxy configured by `VITE_PUBLIC_CORS_PROXY_URL`.

Preview the static build with:

```bash
npm run preview
```

## Preview the complete Worker deployment

```bash
npm run preview:worker
```

Wrangler runs `npm run build:wrangler` automatically, serves the Vite assets, and handles `/corsbypass/` through the Worker.

## Deploy to Cloudflare Workers

Authenticate once:

```bash
npx wrangler login
```

Deploy:

```bash
npm run deploy
```

The `deploy` script runs `wrangler deploy`. Wrangler's custom build command then runs:

```bash
npm run build:wrangler
```

The deployment serves:

```text
/                         Vite application
/assets/*                 Hashed Vite assets
/any-client-route         SPA fallback to index.html
/corsbypass/?url=...      qpackages.com-only proxy
```

Only the proxy route invokes Worker code first. Normal static files are served through Cloudflare Static Assets.

## Environment settings

No environment file is required. The defaults are:

```dotenv
VITE_QPACKAGES_BASE_URL=https://qpackages.com
VITE_PUBLIC_CORS_PROXY_URL=https://api.allorigins.win/raw?url={url}
```

Copy `.env.example` to `.env.local` to replace the public fallback proxy:

```dotenv
VITE_PUBLIC_CORS_PROXY_URL=https://another-proxy.example/raw?url={url}
```

The template must contain `{url}`. The target URL is URL-encoded before insertion.

Do not normally set `VITE_PROXY_MODE`. `.env.wrangler` sets it to `worker` only for the Wrangler-specific build. Vite development is detected independently with `import.meta.env.DEV`.

Public CORS proxies are third-party services and may impose limits or change availability. The Worker deployment is the preferred hosted configuration.

## Verify transport selection

```bash
npm run test:transport
```

This checks the precedence for direct, Vite, Worker, and public-proxy modes without requiring a browser.

## Audit every package/version detail response

The dependency-free audit script walks the root list, every version list, and every detail URL. It records observed paths, JSON types, presence percentages, examples, and failed URLs.

```bash
npm run audit:schema
npm run audit:schema -- --output schema-audit.json --concurrency 4 --timeout 30000
```

Node's `fetch` is not subject to browser CORS restrictions. Detail responses are parsed from text because some qpackages responses may use `application/octet-stream`.

## Project structure

```text
qpackages-explorer/
├── worker/
│   └── index.ts              Cloudflare Worker and restricted proxy
├── scripts/
│   └── audit-schema.mjs      Full catalog schema inspection
├── src/
│   ├── components/
│   ├── lib/
│   │   └── api.ts            Automatic API transport selection
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── .env.wrangler             Wrangler-only Vite build mode
├── vite.config.ts            Vite app and development proxy
├── wrangler.toml             Worker, build, and static asset configuration
└── package.json
```
