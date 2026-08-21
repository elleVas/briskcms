// Not VITE_API_URL: this is the public site's own origin (apps/public-site),
// where both the "Visualizza pagina" link and the preview canvas iframe
// (canvas-frame.tsx) point. Same fallback pattern as VITE_API_URL in
// http-client.ts — a sane local-dev default, always overridden by a real
// domain outside dev.
export const PUBLIC_SITE_URL =
  (import.meta.env['VITE_PUBLIC_SITE_URL'] as string | undefined) ??
  'http://localhost:4321';
