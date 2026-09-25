import { randomUUID } from 'node:crypto';
import type { Block, PickedMedia, PickedPage } from '@brisk/shared-types';
import type { AcfField } from '@brisk/ports';

/**
 * What a value can be turned into that this converter cannot invent.
 *
 * A WordPress image is an attachment id or a URL on the old site; a Brisk
 * `Image` wants a media row that exists here. So the converter asks — and
 * during the analysis, where nothing has been imported and nothing is
 * being written, the answer is always `null`. That is what lets the same
 * code count what it would produce before it produces it.
 */
export interface AcfConversionResolvers {
  resolveMedia(reference: string | number): PickedMedia | null;
  resolvePage(reference: string | number): PickedPage | null;
}

export interface AcfConversionResult {
  blocks: Block[];
  /** Fields that held content this could not place, by path and type. */
  unconverted: { name: string; type: string }[];
  /** Fields passed over because they configure rather than say anything. */
  settingsSkipped: number;
}

/**
 * The field types that hold something a visitor reads.
 *
 * Everything else is how the theme was told to draw it — a `select` for
 * which side the image goes on, a `true_false` for whether to show a
 * header. On the first client site measured, `select` was the **most
 * common field type of all** (167 of 557), and eleven of the sixteen
 * fields on its most-used block were settings. A converter that made one
 * block per field would have produced mostly the words "left" and
 * "large".
 */
const CONTENT_TYPES = new Set([
  'text',
  'textarea',
  'wysiwyg',
  'image',
  'gallery',
  'file',
  'oembed',
  'url',
  'link',
  'page_link',
  'email',
]);

/** Types that hold other fields rather than a value of their own. */
const CONTAINER_TYPES = new Set(['group', 'repeater', 'flexible_content']);

/**
 * A `text` field whose name or label says it is a title.
 *
 * A heuristic, and labelled as one: ACF has no "this is the heading"
 * type, so the only evidence is what somebody called the field. It earns
 * its place — a page whose every title arrived as a paragraph reads
 * wrong at a glance — and the mapping layer above this overrides it the
 * moment somebody says what the block really is.
 */
const TITLE_WORDS = /\b(title|titolo|heading|headline|intestazione)\b/i;
const SUBTITLE_WORDS = /\b(subtitle|sottotitolo|subheading|occhiello)\b/i;

/** Nesting deeper than this is a definition that refers to itself. */
const MAX_DEPTH = 10;

function block(type: string, props: Record<string, unknown>): Block {
  // Every block written needs an id, or a per-language overlay can never
  // attach to it (see `fieldValues` on PageTranslation).
  return { id: randomUUID(), type, props };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Whether these definitions describe anything a visitor would read.
 *
 * Asked of a block before any of its instances are looked at, because
 * the answer is a property of the block and not of the one instance that
 * happened to be sampled. A "latest news" block, for example, has seven
 * fields and all of them are settings: it draws a query, and there is no
 * content of its own to bring across.
 */
export function holdsContent(fields: AcfField[], depth = 0): boolean {
  if (depth >= MAX_DEPTH) return false;
  return fields.some(
    (field) =>
      CONTENT_TYPES.has(field.type) ||
      (CONTAINER_TYPES.has(field.type) &&
        holdsContent(field.children, depth + 1)),
  );
}

/**
 * Turns the values of a site's own custom fields into Brisk blocks,
 * guided by the field definitions that travelled with the export.
 *
 * This is the floor of the WordPress import: it runs on a site nobody has
 * configured anything for, because the shape comes out of the export
 * itself (`AcfSchemaReader`). It does not try to see that six fields
 * together are one `MediaText` — that is the mapping above it — but it
 * never loses a word, and it never emits a block for a setting.
 *
 * `values` is flat, the way ACF stores it: a repeater named `slides` with
 * two rows is `{slides: 2, slides_0_title: …, slides_1_title: …}`.
 */
export function convertAcfFields(
  fields: AcfField[],
  values: Record<string, unknown>,
  resolvers: AcfConversionResolvers,
): AcfConversionResult {
  const result: AcfConversionResult = {
    blocks: [],
    unconverted: [],
    settingsSkipped: 0,
  };
  walk(fields, values, '', resolvers, result, 0);
  return result;
}

function walk(
  fields: AcfField[],
  values: Record<string, unknown>,
  prefix: string,
  resolvers: AcfConversionResolvers,
  result: AcfConversionResult,
  depth: number,
): void {
  if (depth >= MAX_DEPTH) return;

  for (const field of fields) {
    if (field.name === '') continue;
    const path = `${prefix}${field.name}`;

    if (CONTAINER_TYPES.has(field.type)) {
      if (field.type === 'group') {
        walk(field.children, values, `${path}_`, resolvers, result, depth + 1);
        continue;
      }
      // A repeater stores how many rows it has under its own name, and
      // each row under `name_INDEX_subfield`.
      const rows = Number(values[path]);
      if (!Number.isFinite(rows) || rows <= 0) continue;
      for (let index = 0; index < rows; index += 1) {
        walk(
          field.children,
          values,
          `${path}_${index}_`,
          resolvers,
          result,
          depth + 1,
        );
      }
      continue;
    }

    if (!CONTENT_TYPES.has(field.type)) {
      // Counted rather than listed: nobody wants to read about every
      // colour picker on the site.
      result.settingsSkipped += 1;
      continue;
    }

    const converted = convertOne(field, values[path], resolvers);
    if (converted === 'empty') continue;
    if (converted === null) {
      result.unconverted.push({ name: path, type: field.type });
      continue;
    }
    result.blocks.push(...converted);
  }
}

/** `'empty'` when there was nothing there; `null` when there was something this cannot place. */
function convertOne(
  field: AcfField,
  value: unknown,
  resolvers: AcfConversionResolvers,
): Block[] | null | 'empty' {
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'wysiwyg': {
      const body = asString(value);
      if (body === '') return 'empty';
      const named = `${field.name} ${field.label}`;
      if (field.type === 'text' && TITLE_WORDS.test(named)) {
        return [block('Heading', { text: body, level: 'h2' })];
      }
      if (field.type === 'text' && SUBTITLE_WORDS.test(named)) {
        return [block('Heading', { text: body, level: 'h3' })];
      }
      return [block('Text', { body })];
    }

    case 'image': {
      const reference = mediaReference(value);
      if (reference === null) return 'empty';
      const media = resolvers.resolveMedia(reference);
      return media
        ? [
            block('Image', {
              media,
              alt: field.label,
              isDecorative: false,
              caption: '',
            }),
          ]
        : null;
    }

    case 'gallery': {
      const references = Array.isArray(value) ? value : [];
      if (references.length === 0) return 'empty';
      const images = references
        .map(mediaReference)
        .filter((reference): reference is string | number => reference !== null)
        .map((reference) => resolvers.resolveMedia(reference))
        .filter((media): media is PickedMedia => media !== null)
        .map((media) => ({
          media,
          alt: field.label,
          isDecorative: false,
          caption: '',
        }));
      return images.length > 0 ? [block('Gallery', { images })] : null;
    }

    case 'file': {
      const reference = mediaReference(value);
      if (reference === null) return 'empty';
      const media = resolvers.resolveMedia(reference);
      return media
        ? [block('FileDownload', { media, label: field.label })]
        : null;
    }

    case 'oembed': {
      const url = asString(value);
      return url === '' ? 'empty' : [block('VideoEmbed', { url })];
    }

    case 'email': {
      const address = asString(value);
      return address === ''
        ? 'empty'
        : [
            block('Button', {
              label: address,
              linkType: 'url',
              page: null,
              url: `mailto:${address}`,
            }),
          ];
    }

    case 'url':
    case 'link':
    case 'page_link':
      return convertLink(field, value, resolvers);

    default:
      return null;
  }
}

/**
 * How ACF points at an attachment, which depends on how the field was
 * configured: its id, its URL, or the whole attachment as an array.
 */
function mediaReference(value: unknown): string | number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (value !== null && typeof value === 'object') {
    const attachment = value as { ID?: unknown; id?: unknown; url?: unknown };
    for (const candidate of [attachment.ID, attachment.id, attachment.url]) {
      if (typeof candidate === 'number') return candidate;
      if (typeof candidate === 'string' && candidate.trim() !== '') {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * A link becomes a button, because a link with a label is a button.
 *
 * ACF's `link` is `{url, title, target}`; `url` and `page_link` are a
 * bare string, and `page_link` can be a post id. The label falls back to
 * the field's own name: a button with no words on it is worse than one
 * that says "Scopri di più".
 */
function convertLink(
  field: AcfField,
  value: unknown,
  resolvers: AcfConversionResolvers,
): Block[] | null | 'empty' {
  if (typeof value === 'number') {
    const page = resolvers.resolvePage(value);
    return page
      ? [
          block('Button', {
            label: page.title || field.label,
            linkType: 'page',
            page,
            url: '',
          }),
        ]
      : null;
  }

  let url = '';
  let label = '';
  if (typeof value === 'string') {
    url = value.trim();
  } else if (value !== null && typeof value === 'object') {
    const link = value as { url?: unknown; title?: unknown };
    url = asString(link.url);
    label = asString(link.title);
  }

  if (url === '') return 'empty';
  return [
    block('Button', {
      label: label || field.label,
      linkType: 'url',
      page: null,
      url,
    }),
  ];
}

/**
 * Keys whose name says the value configures rather than says something.
 *
 * Matched as the whole key or as its last part, which is what tells
 * `height` and `title_size` from `slides_0_title`. All of them name how
 * a thing is drawn or behaves; none of them is ever something a visitor
 * reads.
 */
const SETTING_WORDS = [
  'size',
  'color',
  'colour',
  'height',
  'width',
  'align',
  'alignment',
  'position',
  'direction',
  'style',
  'layout',
  'variant',
  'radius',
  'padding',
  'margin',
  'target',
  'overlay',
  'opacity',
  'columns',
  'gap',
  'speed',
  'delay',
  'duration',
  'order',
];

function namesASetting(key: string): boolean {
  const lower = key.toLowerCase();
  return SETTING_WORDS.some(
    (word) => lower === word || lower.endsWith(`_${word}`),
  );
}

/** Keys whose name says the value points at a picture. */
const MEDIA_WORDS = /(image|images|photo|foto|media|logo|icon|gallery|file)$/i;

/** A title, when there is no definition to say so: the key must END in a title word. */
const TITLE_KEY = /(^|_)(title|titolo|heading|headline|intestazione)$/i;
const SUBTITLE_KEY = /(^|_)(subtitle|sottotitolo|subheading|occhiello)$/i;

const HEX_COLOUR = /^#[0-9a-f]{3,8}$/i;
const BARE_URL = /^(https?:\/\/|\/|mailto:|tel:)\S*$/i;

/**
 * Recovers what a block holds when the export does not describe it.
 *
 * Not a fallback for rare cases: on the first client site measured, four
 * of its nine block types had **no field group in the export at all** —
 * 12 of 58 instances — because the theme registers those fields in PHP
 * rather than in the database, which is ordinary practice. Without this
 * their words would simply be gone, and "it brings the pages and what is
 * inside them" would be untrue for a fifth of them.
 *
 * With no types to go on, the evidence is the shape of each value and
 * the name of its key. ACF writes a `_name` mirror beside every field,
 * which is how the real fields are told apart from anything else, and
 * writes a repeater's rows as `name_0_sub`, `name_1_sub` — in order, so
 * walking the keys as they come keeps the rows together.
 *
 * When the evidence is thin it emits text. Something that was a setting
 * arriving as a stray word is visible and deletable; a paragraph that
 * never arrived is neither.
 */
export function recoverAcfValues(
  values: Record<string, unknown>,
  resolvers: AcfConversionResolvers,
): AcfConversionResult {
  const result: AcfConversionResult = {
    blocks: [],
    unconverted: [],
    settingsSkipped: 0,
  };

  for (const [key, value] of Object.entries(values)) {
    // `_title` mirrors `title` with the field's key. It is bookkeeping.
    if (key.startsWith('_')) continue;

    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;

    if (typeof value === 'boolean' || isBooleanish(value)) {
      result.settingsSkipped += 1;
      continue;
    }

    if (typeof value === 'string' && HEX_COLOUR.test(value.trim())) {
      result.settingsSkipped += 1;
      continue;
    }

    if (namesASetting(key)) {
      result.settingsSkipped += 1;
      continue;
    }

    if (MEDIA_WORDS.test(key)) {
      const references = Array.isArray(value) ? value : [value];
      const media = references
        .map(mediaReference)
        .filter((reference): reference is string | number => reference !== null)
        .map((reference) => resolvers.resolveMedia(reference))
        .filter((picked): picked is PickedMedia => picked !== null);
      if (media.length === 0) {
        result.unconverted.push({ name: key, type: 'image' });
      } else if (media.length === 1) {
        result.blocks.push(
          block('Image', {
            media: media[0],
            alt: '',
            isDecorative: false,
            caption: '',
          }),
        );
      } else {
        result.blocks.push(
          block('Gallery', {
            images: media.map((one) => ({
              media: one,
              alt: '',
              isDecorative: false,
              caption: '',
            })),
          }),
        );
      }
      continue;
    }

    // `{url, title}` is how ACF stores a link, whatever it is called.
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const link = value as { url?: unknown; title?: unknown };
      const url = asString(link.url);
      if (url !== '') {
        result.blocks.push(
          block('Button', {
            label: asString(link.title) || url,
            linkType: 'url',
            page: null,
            url,
          }),
        );
      }
      continue;
    }

    const body = typeof value === 'number' ? String(value) : asString(value);
    if (body === '') continue;

    if (BARE_URL.test(body)) {
      result.blocks.push(
        block('Button', {
          label: body,
          linkType: 'url',
          page: null,
          url: body,
        }),
      );
      continue;
    }

    if (TITLE_KEY.test(key)) {
      result.blocks.push(block('Heading', { text: body, level: 'h2' }));
    } else if (SUBTITLE_KEY.test(key)) {
      result.blocks.push(block('Heading', { text: body, level: 'h3' }));
    } else {
      result.blocks.push(block('Text', { body }));
    }
  }

  return result;
}

/** ACF writes a checkbox as the string `"0"` or `"1"`. */
function isBooleanish(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    ['0', '1', 'true', 'false'].includes(value.trim().toLowerCase())
  );
}
