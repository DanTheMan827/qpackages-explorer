import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const ALLOWED_HOSTNAME = 'qpackages.com';
const MAX_REDIRECTS = 5;

function sendJson(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

function validateTarget(url: URL): void {
  if (url.protocol !== 'https:') throw new Error('Only HTTPS destinations are allowed.');
  if (url.hostname !== ALLOWED_HOSTNAME) throw new Error(`Only ${ALLOWED_HOSTNAME} is allowed.`);
  if (url.username || url.password) throw new Error('URLs containing credentials are not allowed.');
  if (url.port && url.port !== '443') throw new Error('Only the standard HTTPS port is allowed.');
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchWithValidatedRedirects(initialTarget: URL): Promise<Response> {
  let target = initialTarget;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    validateTarget(target);
    const upstream = await fetch(target, {
      headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8' },
      redirect: 'manual',
    });

    if (!isRedirect(upstream.status)) return upstream;

    const location = upstream.headers.get('location');
    if (!location) return upstream;
    if (redirectCount === MAX_REDIRECTS) throw new Error(`Upstream exceeded ${MAX_REDIRECTS} redirects.`);

    const redirectTarget = new URL(location, target);
    validateTarget(redirectTarget);
    target = redirectTarget;
  }

  throw new Error('Unexpected redirect handling state.');
}

function corsBypassPlugin(): Plugin {
  return {
    name: 'qpackages-cors-bypass',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const requestUrl = new URL(req.url ?? '/', 'http://vite.local');
        if (requestUrl.pathname !== '/corsbypass' && requestUrl.pathname !== '/corsbypass/') {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
          res.setHeader('Access-Control-Max-Age', '86400');
          res.end();
          return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD, OPTIONS' });
          return;
        }

        const rawTarget = requestUrl.searchParams.get('url');
        if (!rawTarget) {
          sendJson(res, 400, { error: 'Missing required url query parameter.' });
          return;
        }

        let target: URL;
        try {
          target = new URL(rawTarget);
          validateTarget(target);
        } catch (error) {
          sendJson(res, 400, {
            error: 'Invalid target URL.',
            message: error instanceof Error ? error.message : 'URL validation failed.',
          });
          return;
        }

        try {
          const upstream = await fetchWithValidatedRedirects(target);
          const body = await upstream.arrayBuffer();

          res.statusCode = upstream.status;
          res.statusMessage = upstream.statusText;
          res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', upstream.headers.get('cache-control') ?? 'no-store');

          const etag = upstream.headers.get('etag');
          if (etag) res.setHeader('ETag', etag);

          if (req.method === 'HEAD') res.end();
          else res.end(Buffer.from(body));
        } catch (error) {
          sendJson(res, 502, {
            error: 'Upstream request failed.',
            message: error instanceof Error ? error.message : 'Unable to fetch upstream URL.',
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), corsBypassPlugin()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
