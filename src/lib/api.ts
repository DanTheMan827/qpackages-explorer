import { selectApiTransport, type ApiTransport } from './apiTransport';
import type { PackageDetail, PackageVersion } from './types';

const SOURCE_BASE_URL = (import.meta.env.VITE_QPACKAGES_BASE_URL ?? 'https://qpackages.com').replace(/\/$/, '');
const PUBLIC_PROXY_TEMPLATE =
  import.meta.env.VITE_PUBLIC_CORS_PROXY_URL ?? 'https://api.allorigins.win/raw?url={url}';
const BUILD_PROXY_MODE = import.meta.env.VITE_PROXY_MODE ?? 'auto';
const SAME_ORIGIN_PROXY_TEMPLATE = '/corsbypass/?url={url}';

export class ApiError extends Error {
  constructor(message: string, readonly targetUrl: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Selects the request transport in this order:
 * 1. Direct requests when the UI itself is hosted on qpackages.com.
 * 2. Vite's same-origin development middleware during `vite dev`.
 * 3. The deployed Worker's same-origin route for Wrangler builds.
 * 4. A configurable public CORS proxy for ordinary static builds.
 */
export function getApiTransport(): ApiTransport {
  return selectApiTransport({
    hostname: typeof window === 'undefined' ? '' : window.location.hostname,
    isViteDev: import.meta.env.DEV,
    buildProxyMode: BUILD_PROXY_MODE,
  });
}

function applyProxyTemplate(template: string, targetUrl: string, variableName: string): string {
  if (!template.includes('{url}')) {
    throw new Error(`${variableName} must contain {url}.`);
  }

  return template.replace('{url}', encodeURIComponent(targetUrl));
}

/** Centralized CORS-routing wrapper used by every API request. */
export function getRequestUrl(targetUrl: string): string {
  switch (getApiTransport()) {
    case 'direct':
      return targetUrl;
    case 'vite-proxy':
    case 'worker-proxy':
      return applyProxyTemplate(SAME_ORIGIN_PROXY_TEMPLATE, targetUrl, 'same-origin proxy template');
    case 'public-proxy':
      return applyProxyTemplate(PUBLIC_PROXY_TEMPLATE, targetUrl, 'VITE_PUBLIC_CORS_PROXY_URL');
  }
}

function sourceUrl(path: string): string {
  return `${SOURCE_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const targetUrl = sourceUrl(path);
  const response = await fetch(getRequestUrl(targetUrl), {
    signal,
    headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8' },
  });
  const raw = await response.text();

  if (!response.ok) {
    let detail = raw.trim();
    try {
      const parsed = JSON.parse(raw) as { error?: string; message?: string };
      detail = parsed.message ?? parsed.error ?? detail;
    } catch {
      // Preserve a plain-text upstream response.
    }
    throw new ApiError(detail || `Request failed with status ${response.status}.`, targetUrl, response.status);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError('The server returned invalid JSON.', targetUrl);
  }
}

export const getPackages = (signal?: AbortSignal) => fetchJson<string[]>('/', signal);

export const getPackageVersions = (id: string, signal?: AbortSignal) =>
  fetchJson<PackageVersion[]>(`/${encodeURIComponent(id)}?limit=0`, signal);

export const getPackageDetail = (id: string, version: string, signal?: AbortSignal) =>
  fetchJson<PackageDetail>(`/${encodeURIComponent(id)}/${encodeURIComponent(version)}`, signal);

export function getDirectSourceUrl(id?: string, version?: string): string {
  if (!id) return sourceUrl('/');
  if (!version) return sourceUrl(`/${encodeURIComponent(id)}?limit=0`);
  return sourceUrl(`/${encodeURIComponent(id)}/${encodeURIComponent(version)}`);
}
