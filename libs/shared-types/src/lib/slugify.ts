/**
 * Shared by the frontend (live preview while typing a page name) and the
 * backend (defense-in-depth: never trust a client-computed slug), so both
 * sides derive the exact same slug from the exact same input.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents (café -> cafe)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
