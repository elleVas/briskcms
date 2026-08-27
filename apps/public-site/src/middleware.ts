import { defineMiddleware } from 'astro:middleware';
import { buildContentSecurityPolicy } from './lib/content-security-policy.js';

// Default for every route: embeddable only by itself. The one route that
// needs something else (the editor's live-preview iframe,
// src/pages/preview/[pageId].astro) sets this same header itself, inside
// its own frontmatter, with its own frame-ancestors value — that call
// happens before this one sees the response (Astro runs the matched
// route's frontmatter as part of `next()`), so checking `.has()` first
// lets that explicit choice stand instead of this default clobbering it.
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!response.headers.has('Content-Security-Policy')) {
    response.headers.set(
      'Content-Security-Policy',
      buildContentSecurityPolicy(`'self'`),
    );
  }
  return response;
});
