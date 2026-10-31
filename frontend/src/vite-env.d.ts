/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Flask API (default "/api") */
  readonly VITE_API_URL?: string;
  /** Deprecated name for VITE_API_URL */
  readonly VITE_REST_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
