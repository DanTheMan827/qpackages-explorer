const ALLOWED_HOSTNAME = 'qpackages.com';
const MAX_REDIRECTS = 5;

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
}

interface WorkerHandler<TEnv> {
  fetch(request: Request, env: TEnv): Promise<Response>;
}

const CORS_HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type, If-Modified-Since, If-None-Match',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type, ETag, Last-Modified',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);

    if (!isProxyPath(requestUrl.pathname)) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonResponse(
        {
          error: 'Method not allowed',
          allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        },
        405,
        { Allow: 'GET, HEAD, OPTIONS' },
      );
    }

    const targetValue = requestUrl.searchParams.get('url');
    if (!targetValue) {
      return jsonResponse(
        {
          error: 'Missing required "url" query parameter',
          usage: '/corsbypass/?url=https%3A%2F%2Fqpackages.com%2F',
        },
        400,
      );
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(targetValue);
      validateTarget(targetUrl);
    } catch (error) {
      return jsonResponse(
        {
          error: 'Invalid target URL',
          message: error instanceof Error ? error.message : 'URL validation failed',
        },
        400,
      );
    }

    try {
      return await proxyRequest(request, targetUrl);
    } catch (error) {
      return jsonResponse(
        {
          error: 'Upstream request failed',
          message: error instanceof Error ? error.message : 'Unknown upstream error',
        },
        502,
      );
    }
  },
} satisfies WorkerHandler<Env>;

function isProxyPath(pathname: string): boolean {
  return pathname === '/corsbypass' || pathname === '/corsbypass/';
}

async function proxyRequest(incomingRequest: Request, initialTarget: URL): Promise<Response> {
  let target = initialTarget;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    validateTarget(target);

    const upstreamHeaders = new Headers({
      Accept: incomingRequest.headers.get('Accept') ?? 'application/json, text/plain;q=0.9, */*;q=0.8',
    });

    copyHeaderIfPresent(incomingRequest.headers, upstreamHeaders, 'If-Modified-Since');
    copyHeaderIfPresent(incomingRequest.headers, upstreamHeaders, 'If-None-Match');

    const upstreamResponse = await fetch(target.toString(), {
      method: incomingRequest.method,
      headers: upstreamHeaders,
      redirect: 'manual',
    });

    if (!isRedirect(upstreamResponse.status)) {
      return corsResponse(upstreamResponse);
    }

    const location = upstreamResponse.headers.get('Location');
    if (!location) {
      return corsResponse(upstreamResponse);
    }

    if (redirectCount === MAX_REDIRECTS) {
      throw new Error(`Upstream exceeded ${MAX_REDIRECTS} redirects`);
    }

    const redirectTarget = new URL(location, target);
    validateTarget(redirectTarget);
    target = redirectTarget;
  }

  throw new Error('Unexpected redirect handling state');
}

function validateTarget(url: URL): void {
  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS destinations are allowed');
  }

  if (url.hostname !== ALLOWED_HOSTNAME) {
    throw new Error(`Only ${ALLOWED_HOSTNAME} is allowed`);
  }

  if (url.username || url.password) {
    throw new Error('URLs containing credentials are not allowed');
  }

  if (url.port && url.port !== '443') {
    throw new Error('Only the standard HTTPS port is allowed');
  }
}

function copyHeaderIfPresent(source: Headers, destination: Headers, name: string): void {
  const value = source.get(name);
  if (value) destination.set(name, value);
}

function corsResponse(upstreamResponse: Response): Response {
  const headers = new Headers(upstreamResponse.headers);

  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }

  headers.delete('Access-Control-Allow-Credentials');
  headers.delete('Set-Cookie');
  headers.append('Vary', 'Origin');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function jsonResponse(
  body: unknown,
  status: number,
  additionalHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...additionalHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
