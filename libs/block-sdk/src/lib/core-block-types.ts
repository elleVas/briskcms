/**
 * Every block type Brisk core ships (docs/adr/0041). A theme's own
 * `.block.ts` must not reuse one of these names — a collision would make
 * the theme's block shadow a core one in the editor's picker, which is an
 * override's job (`blocks/<Name>.astro`), not a new type's.
 *
 * It is a literal list rather than something derived from
 * `@brisk/block-registry`, because that package is React and editor UI:
 * ADR-0037 fixed the dependency direction so a theme — and this SDK — can
 * be built without it. Before this constant existed, every theme had to
 * depend on `block-registry` just to run its own collision check, which
 * meant a theme could not be developed outside this monorepo at all.
 *
 * Drift is not left to discipline: `libs/block-registry`'s own
 * `core-block-types.spec.ts` asserts this list matches the registry's
 * actual descriptors exactly, and fails CI naming what to add or remove.
 * That test is the only place allowed to know both.
 */
export const CORE_BLOCK_TYPES: readonly string[] = [
  'Accordion',
  'AccordionItem',
  'Audio',
  'BackToTop',
  'Banner',
  'BeforeAfter',
  'Breadcrumb',
  'Button',
  'Callout',
  'Card',
  'Carousel',
  'Code',
  'Column',
  'Columns',
  'Container',
  'Countdown',
  'Divider',
  'EmbedHtml',
  'Feature',
  'FeatureGrid',
  'Form',
  'Gallery',
  'HamburgerMenu',
  'Heading',
  'Hero',
  'Icon',
  'Image',
  'ImageSlider',
  'LanguageSwitcher',
  'Link',
  'LogoStrip',
  'MapEmbed',
  'Nav',
  'NavDropdown',
  'NavLink',
  'NewsletterSignup',
  'PricingPlan',
  'PricingTable',
  'PromoBar',
  'Quote',
  'Rating',
  'SearchBox',
  'Section',
  'SocialLink',
  'SocialLinks',
  'Spacer',
  'Stat',
  'StatsCounter',
  'Tab',
  'Table',
  'Tabs',
  'Team',
  'TeamMember',
  'Testimonial',
  'Testimonials',
  'Text',
  'Timeline',
  'TimelineStep',
  'VideoEmbed',
  'VideoFile',
  'WhatsAppButton',
];

/**
 * The block types among `candidates` that collide with a core type. Empty
 * means the theme's block set is safe to ship. Kept separate from
 * `validateThemeBlockSet` so a caller can report it distinctly — a
 * collision is a naming mistake, not a malformed descriptor.
 */
export function findCoreBlockTypeCollisions(
  themeBlockTypes: readonly string[],
): string[] {
  const core = new Set(CORE_BLOCK_TYPES);
  return themeBlockTypes.filter((type) => core.has(type));
}

/**
 * The variants each core block type ships, for the same reason and with
 * the same discipline as `CORE_BLOCK_TYPES` above: a theme may ADD looks
 * to a core block (ADR-0047), and it must not redeclare one the block
 * already has — that would put the same entry in the picker twice, one of
 * them unreachable.
 *
 * A literal map rather than something derived, because deriving it means
 * importing `@brisk/block-registry`, which is React and editor UI: the
 * dependency ADR-0037 removed so a theme can be built outside this
 * monorepo at all. `libs/block-registry`'s own `core-block-types.spec.ts`
 * asserts it matches the real descriptors and fails naming what to fix,
 * exactly as it already does for the type list.
 *
 * Only types that actually declare variants appear. Everything else has
 * one look and nothing to collide with.
 */
export const CORE_BLOCK_VARIANTS: Readonly<Record<string, readonly string[]>> =
  {
    Banner: ['split', 'outline'],
    Button: ['secondary', 'outline', 'ghost', 'link'],
    Card: ['elevated', 'flat', 'horizontal'],
    Feature: ['inline', 'start'],
  };
