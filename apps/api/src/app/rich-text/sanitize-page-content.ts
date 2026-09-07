import { headerFooterBlocks, pageBlocks } from '@brisk/block-registry';
import type { Block, FieldValueOverlay } from '@brisk/shared-types';
import {
  blockTypesById,
  sanitizeRichText,
  transformRichTextInContent,
  transformRichTextInOverlay,
  type IsRichTextField,
} from '@brisk/rich-text';

/**
 * `${blockType}.${fieldKey}` for every core field declared `richtext`.
 * Built once: the registry is static.
 */
const CORE_RICH_TEXT_FIELDS = new Set(
  [...pageBlocks, ...headerFooterBlocks].flatMap((descriptor) =>
    descriptor.fields
      .filter((field) => field.kind === 'richtext')
      .map((field) => `${descriptor.type}.${field.key}`),
  ),
);

/**
 * The core blocks only, which is all this process can know: a theme's
 * blocks are TypeScript modules under `themes/<name>/blocks/`, compiled
 * into the public site by `import.meta.glob` at build time, and a running
 * API cannot load them. That is why sanitising here is one of TWO
 * barriers and not the only one — the renderer, which does have the full
 * registry, sanitises again on the way out (ADR-0046).
 */
export const isCoreRichTextField: IsRichTextField = (blockType, fieldKey) =>
  CORE_RICH_TEXT_FIELDS.has(`${blockType}.${fieldKey}`);

/** Every rich text value in a content tree, made safe to render with `set:html`. */
export function sanitizePageContent(content: Block[]): Block[] {
  return transformRichTextInContent(
    content,
    isCoreRichTextField,
    sanitizeRichText,
  );
}

/**
 * The same for the per-locale overlay, which needs the group's content to
 * turn a block ID into a block type. Without that it would have to
 * sanitise every value, and `Code.code` is deliberately `translatable` —
 * a snippet would lose everything after its first `<`.
 */
export function sanitizeFieldValueOverlay(
  fieldValues: FieldValueOverlay,
  groupContent: Block[],
): FieldValueOverlay {
  return transformRichTextInOverlay(
    fieldValues,
    blockTypesById(groupContent),
    isCoreRichTextField,
    sanitizeRichText,
  );
}
