import type { APIRoute } from 'astro';
import { listPublishedPages } from '../lib/public-api-client.js';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  // A domain that matches no site is a deployment misconfiguration — falls
  // back to "allow" rather than blocking everything for a request that
  // shouldn't be reachable under this domain in the first place.
  const listing = await listPublishedPages(url.hostname);
  const indexingEnabled = listing?.searchEngineIndexingEnabled ?? true;

  // "Discourage search engines from indexing this site" (docs/adr/0016):
  // blocks crawling entirely here, and PageLayout.astro adds a per-page
  // <meta name="robots" content="noindex, nofollow"> on top — belt and
  // braces, since respecting either signal is up to the crawler, not
  // enforced by this server.
  const body = indexingEnabled
    ? `User-agent: *
Allow: /

Sitemap: ${url.origin}/sitemap.xml
`
    : `User-agent: *
Disallow: /
`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
};
