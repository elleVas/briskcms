import { randomBytes } from 'node:crypto';
import { defineMiddleware } from 'astro:middleware';
import { buildContentSecurityPolicy } from './lib/content-security-policy';
import { resolveIconSvg } from './lib/resolve-theme-icons';

// Default for every route: embeddable only by itself. The one route that
// needs something else (the editor's live-preview iframe,
// src/pages/preview/[pageId].astro) sets this same header itself, inside
// its own frontmatter, with its own frame-ancestors value — that call
// happens before this one sees the response (Astro runs the matched
// route's frontmatter as part of `next()`), so checking `.has()` first
// lets that explicit choice stand instead of this default clobbering it.
export const onRequest = defineMiddleware(async (context, next) => {
  // Generated BEFORE `next()`, not after: the matched route's own
  // frontmatter (PageLayout.astro, via Astro.locals) needs the same value
  // this middleware puts in the CSP header, whichever of the two branches
  // below ends up setting it — a nonce only works when the header and the
  // tag agree on the exact same string.
  context.locals.cspNonce = randomBytes(16).toString('base64');

  // Handed to themes rather than imported by them: the icon registry is an
  // eager glob over themes/<name>/icons/ plus lucide-static resolved via
  // import.meta.resolve, none of which a theme package could carry. A
  // theme importing it from this app is precisely what stopped a theme
  // from living outside this repo. The contract is typed in
  // @brisk/theme-runtime ('BriskThemeLocals'); this is the only place that
  // fills it in. Free to set unconditionally — resolveIconSvg builds its
  // per-theme map lazily, on the first call that actually needs it.
  context.locals.resolveIcon = resolveIconSvg;

  const response = await next();
  if (!response.headers.has('Content-Security-Policy')) {
    response.headers.set(
      'Content-Security-Policy',
      buildContentSecurityPolicy(`'self'`, context.locals.cspNonce),
    );
  }
  return response;
});
