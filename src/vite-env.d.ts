/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QPACKAGES_BASE_URL?: string;
  readonly VITE_PUBLIC_CORS_PROXY_URL?: string;
  readonly VITE_PROXY_MODE?: 'auto' | 'worker';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
