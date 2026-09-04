import { z } from 'zod';
import type { Block, PageContent } from './content-model';

/**
 * ONE locale's translated text — only fields marked `translatable`
 * (`FieldDescriptor.translatable` in `@brisk/block-registry`) have an entry
 * here; an absent field inherits the shared value from `PageGroup.content`
 * (falling back to the site's default language). Keyed by block id and then
 * by field key — with no reference to the block's `kind`/type:
 * `mergeTranslatedContent` below does not (and must not) need to know which
 * fields are translatable, only which overrides actually exist. That
 * decision (where a change should be written: here or to
 * `PageGroup.content`) is the writer's responsibility, not the reader's —
 * see editor-app's InspectorPanel/usePropertyPatch.
 */
export const fieldValueOverlaySchema = z.record(
  z.string(),
  z.record(z.string(), z.string()),
);
export type FieldValueOverlay = z.infer<typeof fieldValueOverlaySchema>;

function mergeBlock(block: Block, fieldValues: FieldValueOverlay): Block {
  const overrides = block.id ? fieldValues[block.id] : undefined;
  const children = block.children?.map((child) =>
    mergeBlock(child, fieldValues),
  );
  return {
    ...block,
    props: overrides ? { ...block.props, ...overrides } : block.props,
    ...(children ? { children } : {}),
  };
}

/**
 * Produces the renderable tree for ONE language: the shared canonical
 * structure (`groupContent`, `PageGroup.content`) with that language's text
 * values grafted on top. A block without an `id` (which should not happen
 * after the initial backfill) never receives an override — there is no
 * reliable way to know which `fieldValues` entry it corresponds to. Pure
 * and one-way: it never produces `fieldValues` from a `PageContent` — that
 * direction (extracting overrides from already-written content) is the
 * one-off backfill script's job, not this function's.
 */
export function mergeTranslatedContent(
  groupContent: PageContent,
  fieldValues: FieldValueOverlay,
): PageContent {
  return groupContent.map((block) => mergeBlock(block, fieldValues));
}
