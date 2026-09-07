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
 * The words of a rich text value, without the markup — for the search
 * index, which would otherwise fill with tag names, and for anywhere a
 * preview needs one line of text (a card, a meta description default).
 *
 * Tags are stripped by pattern rather than parsed, and no sanitiser is
 * involved, for a reason that matters to where this file lives: it is
 * used by `search-text.ts`, which every app already imports, and pulling
 * `sanitize-html` in here would put an HTML parser in the editor's
 * browser bundle to do a job that does not need one. The input is HTML
 * this product wrote and already sanitised — a closed, tiny tag set — and
 * the worst outcome of imprecision is a slightly noisy index.
 *
 * A value that does not begin with a tag is returned as it is. Those are
 * the plain strings every one of these fields held before ADR-0046, and
 * stripping `<[^>]*>` from `Costa < 10 euro > 5` would delete the middle
 * of the sentence.
 *
 * Two details that change what a reader sees. Block-level tags become a
 * space, or `<p>a</p><p>b</p>` indexes as "ab" and neither word is
 * findable. And entities are decoded, because callers put this into TEXT
 * positions: `Rossi &amp; Figli` in a search result is a bug. `&amp;` is
 * decoded last, so `&amp;lt;` — a literal "&lt;" someone typed — comes
 * back as "&lt;" and not as "<".
 */
export function richTextToPlainText(value: string): string {
  if (value.trimStart() === '' || !value.trimStart().startsWith('<')) {
    return value.replace(/\s+/g, ' ').trim();
  }
  const stripped = value
    .replace(/<\/(p|li|ul|ol|div|blockquote)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '');
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
