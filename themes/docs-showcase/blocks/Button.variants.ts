import type { ThemeBlockVariant } from '@brisk/block-sdk';

/**
 * The looks this theme adds to the CORE Button (ADR-0047, under
 * ADR-0048's additive rule) — not a redefinition: core's own `secondary`
 * stays, and every Button already saved keeps working.
 *
 * This is the shape the Figma workflow arrives in. A design file hands
 * over a component with several button variants; each becomes an entry
 * here and a `.brisk-button--<value>` rule in `Button.astro`. Before
 * this, the only way was a whole `MyButton` block type, which duplicated
 * every field and lost the core Button along with it.
 *
 * Labels are strings, not i18n keys: a theme cannot add keys to the
 * editor's bundles at build time, so they travel with the data and are
 * registered on arrival.
 */
const variants: ThemeBlockVariant[] = [
  {
    value: 'ghost',
    label: { en: 'Ghost', it: 'Fantasma' },
  },
];

export default variants;
