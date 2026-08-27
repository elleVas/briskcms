import { createHash } from 'node:crypto';
import { PROMO_BAR_DISMISS_SCRIPT } from '../components/blocks/promo-bar-dismiss-script.js';

/**
 * Every core block's own `<script>` (no `is:inline`) gets bundled by Astro
 * into an external, same-origin file — already covered by `'self'`.
 * PromoBar.astro's dismiss-check is the one exception, kept `is:inline` on
 * purpose (must run before first paint, or a visitor who already dismissed
 * the bar sees a flash of it) — a hash entry admits exactly that one known
 * script instead of a blanket `'unsafe-inline'`. Computed from the same
 * string the component renders (see promo-bar-dismiss-script.ts), so it
 * can never drift out of sync with the actual script content.
 */
function scriptHash(source: string): string {
  const digest = createHash('sha256').update(source).digest('base64');
  return `'sha256-${digest}'`;
}

/**
 * `script-src`/`style-src` stay otherwise as tight as `'self'` (plus the
 * one hash above) allows: `embed-html` (see EmbedHtml.astro) is a
 * deliberate product feature letting a site owner paste arbitrary
 * third-party HTML/JS (analytics snippets, chat widgets, Calendly, ...).
 * It runs isolated in a sandboxed `<iframe>` with its own permissive CSP
 * (declared inside the srcdoc itself, see EmbedHtml.astro) — this policy
 * only has to cover everything Brisk's OWN 48 blocks + Astro's own bundled
 * scripts need, which is why it can stay strict everywhere instead of
 * being loosened to accommodate that isolated iframe's own separate
 * policy.
 *
 * Every other directive here has zero legitimate use case on a page this
 * product renders, so there's no tradeoff to weigh: `object-src 'none'`
 * (no plugins), `base-uri 'self'` (no `<base>`-tag hijack of relative
 * URLs), `upgrade-insecure-requests` (no accidental http:// subresource).
 * `frame-ancestors` is the one directive real callers need to vary (the
 * editor's own live-preview route embeds a page in an iframe from
 * EDITOR_APP_URL, every real published page never should be), so it's a
 * parameter here rather than baked in.
 */
// Form.astro/NewsletterSignup.astro's anti-spam widget (docs/adr/0020) —
// its script renders its own challenge inside an iframe from this same
// host, and calls home to verify solve state.
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

// VideoEmbed.astro/MapEmbed.astro's click-to-load iframes (ConsentGatedEmbed)
// — every embeddable host is normalized to exactly one of these three by
// video-embed.ts/MapEmbed.astro itself (YouTube/Vimeo URLs are parsed and
// re-built into one canonical embed URL, Google Maps only ever gets built
// from a fixed template), never an arbitrary user-supplied iframe src.
const EMBEDDABLE_FRAME_ORIGINS = [
  TURNSTILE_ORIGIN,
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.google.com',
];

export function buildContentSecurityPolicy(frameAncestors: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' ${TURNSTILE_ORIGIN} ${scriptHash(PROMO_BAR_DISMISS_SCRIPT)}`,
    `style-src 'self' 'unsafe-inline' https:`,
    `img-src 'self' data: https:`,
    `font-src 'self' https: data:`,
    `frame-src ${EMBEDDABLE_FRAME_ORIGINS.join(' ')}`,
    `connect-src 'self' ${TURNSTILE_ORIGIN}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors ${frameAncestors}`,
    `upgrade-insecure-requests`,
  ].join('; ');
}
