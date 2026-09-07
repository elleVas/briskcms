import sanitizeHtml from 'sanitize-html';

/** Everything but `&amp;`, which has to go last — see below. */
const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * The words, without the markup — for the search index, which would
 * otherwise fill with tag names, and for anywhere a preview needs one
 * line of text (a card, a list, a meta description default).
 *
 * Two details that are easy to get wrong and both change what a reader
 * sees:
 *
 * Block-level tags become a space rather than nothing, or `<p>a</p><p>b</p>`
 * indexes as "ab" and neither word is findable.
 *
 * Entities are decoded, because the callers put this into TEXT positions.
 * Leaving `&amp;` would show a meta description reading "Rossi &amp;
 * Figli" in a search result. `&amp;` is decoded last so that `&amp;lt;`
 * — a literal "&lt;" someone actually typed — comes back as "&lt;" and
 * not as "<".
 */
export function richTextToPlainText(value: string): string {
  const spaced = value.replace(/<\/(p|li|ul|ol|br)>|<br\s*\/?>/gi, ' ');
  const stripped = sanitizeHtml(spaced, {
    allowedTags: [],
    allowedAttributes: {},
  });
  const decoded = Object.entries(ENTITIES)
    .reduce(
      (text, [entity, char]) => text.split(entity).join(char),
      stripped.replace(/&#(\d+);/g, (_m, code: string) =>
        String.fromCodePoint(Number(code)),
      ),
    )
    .split('&amp;')
    .join('&');
  return decoded.replace(/\s+/g, ' ').trim();
}
