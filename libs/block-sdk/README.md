# block-sdk

The public surface for authoring a Brisk block — first-party or third-party.
`defineBlock()` is a validated factory for a `BlockDescriptor`, the same
plain-data shape every one of `libs/block-registry`'s ~50 blocks already
returns (see that package's own README). This package exists so a block
author only needs `@brisk/block-sdk` — not `@brisk/block-registry`, which
also happens to contain the implementation of every core block.

## Why a separate package, not just a function in `block-registry`

Importing from a package that also contains all the first-party blocks
blurs "this is the stable extension contract" with "this is Brisk's
internal implementation" — a real design fork, decided with the project
author 2026-09-01 (see
[ADR-0037](../../docs/adr/0037-block-sdk-third-party-block-extensions.md)).

The dependency direction follows from that choice: `block-registry` depends
on `block-sdk` for the `BlockDescriptor`/`FieldDescriptor` type contract
(re-exported from its own `field-types.ts` so none of its ~50 existing
`*.block.ts` files needed to change), not the other way around — `block-sdk`
(the public surface) can't depend on `block-registry` (built against that
surface) without a circular dependency.

## `defineBlock()`

```ts
import { defineBlock } from '@brisk/block-sdk';
import { z } from 'zod';

const calloutSchema = z.object({
  message: z.string(),
  tone: z.enum(['info', 'warning', 'success']),
});

export const calloutBlock = defineBlock({
  type: 'Callout',
  label: 'blocks.callout.label',
  category: 'content',
  schema: calloutSchema,
  defaultProps: { message: 'Your message here', tone: 'info' },
  fields: [
    {
      kind: 'textarea',
      key: 'message',
      translatable: true,
      label: 'blocks.callout.fields.message.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'select',
      key: 'tone',
      label: 'blocks.callout.fields.tone.fieldLabel',
      options: [
        { label: 'blocks.callout.fields.tone.options.info', value: 'info' },
        {
          label: 'blocks.callout.fields.tone.options.warning',
          value: 'warning',
        },
        {
          label: 'blocks.callout.fields.tone.options.success',
          value: 'success',
        },
      ],
    },
  ],
});
```

`schema` is a required Zod schema — the single source of truth `defaultProps`
is checked against, consistent with this project's existing "a Zod schema is
the source of truth" precedent
([ADR-0026](../../docs/adr/0026-shared-zod-schemas-for-api-response-shapes.md)).
`defineBlock()` calls `schema.parse(defaultProps)` the moment the module
loads: a typo'd or missing default fails immediately and loudly at import
time, not silently at first render. The schema itself is **not** stored on
the returned `BlockDescriptor` — that type has no such field — you pass the
same schema again, separately, when you register your render component (see
below). `type`/`label`/`category`/`fields`/`isContainer`/`allowedChildTypes`/
`stylableProperties`/`defaultStyle` are documented in `block-registry`'s own
README (the `BlockDescriptor`/`FieldDescriptor` shapes now live here, in this
package's `field-types.ts`, but the documentation of what each field means
stays there to avoid duplicating it in two READMEs).

## What `defineBlock()` deliberately does NOT do

It cannot unify block _registration_ into one call, because a block's
render component is a separate Astro file in `apps/public-site`, and
Brisk's distribution model is build-time-only — one Docker image per
deployment, no runtime plugin loading
([ADR-0021](../../docs/adr/0021-site-theming-filesystem-packages-and-style-settings.md),
[ADR-0032](../../docs/adr/0032-one-container-per-site-deployment-unit.md)).
Adding a block — first-party or third-party — still means a rebuild and
still means touching a small, fixed set of places by hand. `defineBlock()`
narrows that list; it doesn't remove it. A future **Extension Manifest**
(dynamic runtime block/plugin discovery) is explicitly out of scope here —
deferred post-launch, see `piano-progetto-astro-cms.md`'s "Considerazioni
aggiuntive" point 2 and ADR-0037's Consequences.

### The full registration walk-through (worked example: `Callout`)

`libs/block-registry/src/lib/blocks/callout.block.ts` is a real, live block
built with `defineBlock()` — not a standalone, unregistered sample — so you
can trace every step against actual code instead of a hypothetical. To add
a block of your own, in order:

1. **Schema** — a `z.object({...})` + inferred type, in
   `libs/shared-types/src/lib/content-model.ts` (see `calloutPropsSchema`).
   This is the one piece `defineBlock()` needs from you and the one piece
   `BlockRenderer.astro` (step 4) needs again, separately.
2. **Descriptor** — a `.block.ts` file calling `defineBlock()` (see
   `callout.block.ts`), registered in `libs/block-registry/src/lib/config.ts`:
   add the import, add it to the `pageBlocks` array, add its `type` string to
   the right entry in `pageBlockCategories`.
3. **Render component** — an `.astro` file in
   `apps/public-site/src/components/blocks/` (see `Callout.astro`) — this is
   the _only_ renderer for the block; both the public site and the editor's
   live canvas preview use it (the canvas renders inside a sandboxed iframe
   showing this exact same output, not a separate React re-implementation).
4. **Dispatch entry** — in `apps/public-site/src/components/BlockRenderer.astro`:
   import the component, wrap it with `resolveThemeBlockOverride()`, add an
   entry to the `BLOCK_REGISTRY` table with the schema from step 1.
5. **Labels** — `blocks.<type>.label` and `blocks.<type>.fields.*` keys in
   `apps/editor-app/src/locales/en.json` and `it.json`.
6. Optional: `libs/shared-types/src/lib/search-text.ts`'s `proseFieldsFor()`
   if the block carries prose text that should be full-text searchable (see
   its own doc comment for why this is an explicit allowlist, not automatic).

## Running unit tests

Run `nx test block-sdk` to execute the unit tests via [Vitest](https://vitest.dev/).
