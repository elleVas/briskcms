import type { ComponentType } from 'react';
import type {
  BlockStyleDefaults,
  BlockStyleOverride,
} from '@brisk/shared-types';

/**
 * The public block-authoring data contract — every first-party block in
 * `libs/block-registry/src/lib/blocks/*.block.ts` is defined against this
 * exact same type (re-exported there from here, see that lib's
 * `field-types.ts`), and `defineBlock()` below returns it. Lives in
 * `block-sdk`, not `block-registry`, so a third-party block author only
 * needs this package — not the internal lib that also happens to contain
 * every core block's implementation.
 */
export type FieldDescriptor =
  | {
      kind: 'text';
      key: string;
      label: string;
      inlineEditable?: boolean;
      placeholder?: string;
      /** Shows a required marker + inline warning when empty — a soft nudge, never blocks saving/publishing. */
      required?: boolean;
      /** Name of a sibling boolean prop that, when true, waives `required` — e.g. an "isDecorative" flag legitimately making an empty value correct, not an oversight. */
      requiredUnless?: string;
      /**
       * Opt-in, explicit — never derived from `inlineEditable` or `kind`.
       * A field can be free text without being locale-specific content
       * (e.g. an external URL typed via `kind: 'text'`), and conversely can
       * be translatable without being inline-editable (e.g. an image `alt`
       * attribute rather than a visible canvas node) — neither existing
       * flag is a reliable proxy, so this is its own field. `false`/absent
       * = the value lives on the shared page-group structure, same for
       * every locale; `true` = per-locale override.
       */
      translatable?: boolean;
    }
  | {
      kind: 'textarea';
      key: string;
      label: string;
      inlineEditable?: boolean;
      placeholder?: string;
      required?: boolean;
      requiredUnless?: string;
      translatable?: boolean;
    }
  | {
      kind: 'radio' | 'select';
      key: string;
      label: string;
      options: { label: string; value: string }[];
    }
  | {
      kind: 'number';
      key: string;
      label: string;
      min?: number;
      max?: number;
      step?: number;
    }
  | { kind: 'boolean'; key: string; label: string }
  | {
      kind: 'custom';
      key: string;
      label: string;
      component: ComponentType<{
        value: unknown;
        onChange: (v: unknown) => void;
      }>;
    };

/**
 * A single point for the cast a `kind: 'custom'` field requires by
 * construction: each concrete picker (PagePickerField, MediaPickerField...)
 * has a `value`/`onChange` typed to its own domain (e.g. `PickedPage |
 * null`), but the `FieldDescriptor[]` array is heterogeneous and must stay
 * homogeneous — TypeScript can't express "this component is only ever used
 * for prop X, which the domain schema guarantees is V" inside an array of
 * this type. Concentrated here, with one comment, instead of repeated at
 * every call site.
 */
export class FieldBuilder {
  static custom<V>(
    key: string,
    label: string,
    component: ComponentType<{ value: V; onChange: (value: V) => void }>,
  ): FieldDescriptor {
    return {
      kind: 'custom',
      key,
      label,
      component: component as unknown as ComponentType<{
        value: unknown;
        onChange: (value: unknown) => void;
      }>,
    };
  }
}

export interface BlockDescriptor<Props = Record<string, unknown>> {
  type: string;
  label: string;
  category: string;
  defaultProps: Props;
  fields: FieldDescriptor[];
  /** `Block.children` is real (no Puck-style "slot" mapper needed) — present only on blocks that can contain other blocks. */
  isContainer?: boolean;
  /** No list = any registered block can go inside (e.g. Column/Container). */
  allowedChildTypes?: string[];
  /**
   * Which shared style properties (docs/adr/0022) make sense for this
   * type — not every block uses every property (Text has no sensible
   * "border radius"). Absent/empty = no "Style" button or per-instance
   * override popover for this type: rollout is incremental, not a
   * mechanical addition to every block type at once (see the ADR for why).
   */
  stylableProperties?: readonly (keyof BlockStyleOverride)[];
  /**
   * The default CSS expression for each of this type's `stylableProperties`
   * — e.g. `{ borderRadius: 'var(--radius)', paddingX: '1.25rem' }` —
   * copied 1:1 from the fallback its `.astro` component already uses (e.g.
   * `var(--brisk-override-radius, var(--radius))`), not invented: this is
   * the same source of truth, just declared here instead of staying
   * visible only inside a CSS file. A reference to a theme custom property
   * (`var(--x)`) is resolved against the active theme's `theme.css` by
   * `apps/public-site/src/lib/resolve-theme-block-style-defaults.ts` before
   * reaching the editor — a literal (e.g. `'transparent'`, `'0.5rem'`)
   * passes through unchanged. Present only when `stylableProperties` is
   * non-empty, with the same keys.
   */
  defaultStyle?: BlockStyleDefaults;
}
