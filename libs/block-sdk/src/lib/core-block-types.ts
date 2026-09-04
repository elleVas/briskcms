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
  'BackToTop',
  'Banner',
  'BeforeAfter',
  'Breadcrumb',
  'Button',
  'Callout',
  'Code',
  'Column',
  'Columns',
  'Container',
  'Countdown',
  'EmbedHtml',
  'Feature',
  'FeatureGrid',
  'Form',
  'Gallery',
  'HamburgerMenu',
  'Heading',
  'Hero',
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
