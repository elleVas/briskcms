import { requireEnv } from '@brisk/env-config';

// process.env, non import.meta.env: letta a request time (SSR, Node), non
// a build time — stesso motivo di API_URL in public-api-client.ts. Origine
// autorizzata sia per l'header CSP frame-ancestors della rotta di preview
// sia per il CORS di render-block-fragment.ts (entrambi gated dal token di
// preview, non da questo valore — è solo "chi può imbarcare/chiamare",
// l'autenticazione vera resta il token).
export function editorAppUrl(): string {
  return requireEnv('EDITOR_APP_URL');
}
