import { sanitizeRichText } from './sanitize-rich-text';

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Turns any stored value into valid, safe rich text — whether it already
 * is HTML or is a plain string written before `kind: 'richtext'` existed.
 *
 * Every one of the thirteen textarea fields held plain text until
 * ADR-0046, and plain text read back through `set:html` does not survive:
 * `Rossi & Figli` renders as `Rossi ` in some browsers and the rest is
 * eaten as an entity, and a line containing `<` loses everything after
 * it. A one-off migration script fixes the stored data — but scripts in
 * this repo are run by hand (`pnpm db:backfill-block-ids` and friends),
 * and a self-hoster who upgrades without running one would find their
 * site quietly missing text. So the READ path normalises too, and the
 * script becomes tidying rather than a precondition.
 *
 * The test for "is this already HTML" is whether it starts with a tag.
 * Deliberately crude: a migrated value always does, because migration
 * wraps in `<p>`, and legacy plain text essentially never does. The one
 * value it misreads is legacy text that genuinely begins with `<`, which
 * would be sanitised rather than escaped — worth naming, not worth a
 * parser.
 *
 * Idempotent by construction, which is what lets it sit on both paths and
 * in the script: the output always starts with a tag, so a second pass
 * takes the sanitise branch and changes nothing.
 */
export function normalizeRichText(value: string): string {
  if (value.trim() === '') {
    return '';
  }
  if (value.trimStart().startsWith('<')) {
    return sanitizeRichText(value);
  }
  return value
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
    .map(
      (paragraph) =>
        `<p>${escapeText(paragraph).split('\n').join('<br />')}</p>`,
    )
    .join('');
}
