export type ApiTransport = 'direct' | 'vite-proxy' | 'worker-proxy' | 'public-proxy';

export interface ApiTransportContext {
  hostname: string;
  isViteDev: boolean;
  buildProxyMode?: string;
}

/** Pure transport selection so the precedence can be tested without a browser. */
export function selectApiTransport({
  hostname,
  isViteDev,
  buildProxyMode = 'auto',
}: ApiTransportContext): ApiTransport {
  if (hostname.toLowerCase() === 'qpackages.com') return 'direct';
  if (isViteDev) return 'vite-proxy';
  if (buildProxyMode === 'worker') return 'worker-proxy';
  return 'public-proxy';
}
