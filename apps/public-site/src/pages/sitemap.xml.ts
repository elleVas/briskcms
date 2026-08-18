import type { APIRoute } from 'astro';
import { listPublishedPagesForSitemap } from '../lib/public-api-client.js';

// Explicit even though this route has no dynamic [param] segment (see
// [slug].astro's own comment on why a bracketed route needs it) — this
// genuinely has to run per-request (a fresh page list every time, not a
// once-at-build snapshot), so the intent is spelled out rather than
// relying on output: 'server' alone to imply it for a static-looking path.
export const prerender = false;

// index.astro's own convention: "/" answers whichever page is slugged
// "home" — the sitemap has to mirror that mapping so <loc> matches the
// real reachable URL, not a slug that 404s.
function slugToPath(slug: string): string {
  return slug === 'home' ? '/' : `/${slug}`;
}

export const GET: APIRoute = async ({ url }) => {
  const entries = await listPublishedPagesForSitemap(url.hostname);

  const urlEntries = entries
    .map(
      (entry) => `  <url>
    <loc>${url.origin}${slugToPath(entry.slug)}</loc>
    <lastmod>${new Date(entry.updatedAt).toISOString()}</lastmod>
  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
