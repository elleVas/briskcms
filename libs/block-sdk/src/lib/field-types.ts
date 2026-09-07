import type {
  BlockStyleDefaults,
  BlockStyleOverride,
  CustomFieldControl,
} from '@brisk/shared-types';

export type { CustomFieldControl };

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
      /**
       * Long text that may carry formatting and, above all, a link INSIDE
       * a sentence (ADR-0046). The value is an HTML string, sanitised on
       * write against a strict allowlist (`@brisk/rich-text`), so a
       * renderer can trust it and use `set:html`.
       *
       * A string and not a document tree on purpose: the per-locale
       * translation overlay (`fieldValueOverlaySchema`) maps a field to a
       * STRING, so keeping it one means translating rich text works on
       * the day this ships, with no change to translation at all.
       *
       * `textarea` stays for content that is literal by definition —
       * `Code.code`, `EmbedHtml.html` — where formatting would corrupt
       * the value rather than enrich it.
       */
      kind: 'richtext';
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
      /**
       * WHICH editor control renders this field, by name — not the
       * component itself.
       *
       * It used to be a live `ComponentType`, and that one property
       * decided a surprising amount: a descriptor holding a React
       * component is not data, so the whole registry could only be read
       * by something that runs React. The API could not look at a
       * descriptor to find out which fields hold rich text
       * (ADR-0046) without pulling React into a Node server, and a theme
       * could not declare a custom field at all, because the value
       * cannot survive JSON — a limitation `themeFieldDescriptorSchema`
       * had to write down rather than solve.
       *
       * A name crosses every one of those boundaries. The editor keeps
       * the map from name to component, which is where the React
       * belongs; everything else reads the descriptor as what it is.
       */
      control: CustomFieldControl;
    };

/**
 * Kept as the way to declare a custom field, though it no longer has
 * anything to hide: it used to exist for a cast, because each concrete
 * picker typed `value`/`onChange` to its own domain while
 * `FieldDescriptor[]` had to stay homogeneous. Naming the control instead
 * of holding the component removed the mismatch rather than concentrating
 * it, so the generic and the cast are both gone.
 */
export class FieldBuilder {
  static custom(
    key: string,
    label: string,
    control: CustomFieldControl,
  ): FieldDescriptor {
    return { kind: 'custom', key, label, control };
  }
}

/**
 * A style property a block offers: one core ships, or one a THEME added
 * (ADR-0047's consequence on `stylableProperties`).
 *
 * `string & {}` rather than a plain `string`, which would collapse the
 * union and lose autocomplete on the twenty-one core names. `Extract`
 * because the override schema has a catchall, which widens its `keyof` to
 * include `number` — a property name never is one — the point is
 * to keep those suggested while not making core the only possible source
 * of properties, which is what contradicted ADR-0037 and ADR-0041.
 */
export type BlockStylePropertyName =
  Extract<keyof BlockStyleOverride, string> | (string & {});

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
  stylableProperties?: readonly BlockStylePropertyName[];
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
  /**
   * The named looks this block type offers, picked from a menu in the
   * editor (ADR-0047). Absent/empty = the type has one look and no
   * picker appears.
   *
   * Enumerated and not free text, which is the whole reason the primitive
   * is a "variant" rather than a class: a class is a developer's tool, a
   * variant is a product concept the client can also use without being
   * able to invent nonsense. It is also the shape design actually arrives
   * in — a Figma component with twenty button variants.
   *
   * The chosen value lives on `Block.variant`, NOT in props: props are
   * the client's content and a theme is a view over it (ADR-0048), so a
   * theme may add variants here or hide one it has no design for without
   * touching a single stored page.
   *
   * `value` becomes part of a CSS class (`.brisk-button--secondary`), so
   * it must satisfy `blockVariantNameSchema`; `label` is an i18n key like
   * every other label here.
   */
  variants?: readonly { value: string; label: string }[];
}
