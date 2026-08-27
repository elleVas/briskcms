import { requireViteEnv } from './require-vite-env.js';

// Not VITE_API_URL: this is the public site's own origin (apps/public-site),
// where both the "Visualizza pagina" link and the preview canvas iframe
// (canvas-frame.tsx) point. Same requireViteEnv pattern as VITE_API_URL in
// http-client.ts — fail loud rather than silently pointing at localhost if
// unset outside dev.
export const PUBLIC_SITE_URL = requireViteEnv('VITE_PUBLIC_SITE_URL');
