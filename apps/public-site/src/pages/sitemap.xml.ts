import type { APIRoute } from 'astro';
import { listPublishedPages } from '../lib/public-api-client.js';

// Dynamic (not known at build time) — same reasoning as [slug].astro.
export const prerender = false;

// The public API's PublishedPage/sitemap listing has no notion of a
// homepage slug of its own — 'home' is this app's own routing convention
// (see src/pages/index.astro), so the mapping back to '/' lives here too.
function slugToPath(slug: string): string {
  return slug === 'home' ? '/' : `/${slug}`;
}

export const GET: APIRoute = async ({ url }) => {
  // A domain that matches no site is a deployment misconfiguration, not a
  // per-request error — an empty sitemap is more useful to a crawler than a
  // 404 here, so this falls back to `[]` rather than erroring out. Listing
  // pages here is independent of the site's indexing preference — robots.txt
  // (not this route) is what actually tells a compliant crawler to stay away.
  const listing = await listPublishedPages(url.hostname);
  const entries = listing?.items ?? [];

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
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
};
