import type {
  ComponentData,
  DefaultComponentProps,
  Field,
  Fields,
} from '@puckeditor/core';

/**
 * Puck's canvas inline-editing (InlineTextField) loses the caret when its
 * block sits inside a Slot (e.g. Column/Container children): on every
 * keystroke Puck replaces the contentEditable DOM node whenever its
 * `innerText` doesn't already match the store value, and Slot children don't
 * keep stable DOM identity across that replace — new text lands wherever the
 * fresh node happens to mount, not at the caret. Not reproducible for
 * root-level blocks. Until upstream fixes Slot+InlineTextField
 * reconciliation, every `contentEditable` field falls back to the sidebar
 * textarea (`visible: true`) whenever the block is nested — every block's
 * `resolveFields` calls this with its own static `fields` plus Puck's
 * `parent` param. Puck never passes `null` here in practice: a block sitting
 * directly in the page's own root zone still gets a synthetic
 * `{ type: 'root', ... }` parent, so nested-in-a-Slot is `parent.type` being
 * an actual block type, not the `parent` reference itself being non-null.
 */
export function withInlineTextFallback<T extends DefaultComponentProps>(
  fields: Fields<T>,
  parent: ComponentData | null,
): Fields<T> {
  const isNested = parent !== null && parent.type !== 'root';
  // Widened to a non-generic record: Fields<T> can only be indexed for
  // reading when T is generic (TS2862) — this only ever touches `visible`
  // (present on every Field variant via BaseField), so the cast back is a
  // provably unchanged shape, not a lossy one.
  const result: Record<string, Field> = { ...fields };
  for (const key in result) {
    const field = result[key];
    if (field && 'contentEditable' in field && field.contentEditable) {
      result[key] = { ...field, visible: isNested };
    }
  }
  return result as Fields<T>;
}

/**
 * Every block wires this as its `resolveFields`, one call site each
 * (`resolveFields: createResolveFields(fields)`) — kept as a single shared
 * closure factory, rather than each block writing its own inline arrow
 * function, so coverage tooling tracks one function body instead of one
 * per block regardless of which block's test happens to exercise it.
 */
export function createResolveFields<T extends DefaultComponentProps>(
  fields: Fields<T>,
): (data: unknown, params: { parent: ComponentData | null }) => Fields<T> {
  return (_data, { parent }) => withInlineTextFallback(fields, parent);
}
