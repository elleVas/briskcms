import type { BlockStyleDefaults } from './site-theme-tokens';

/**
 * The default CSS expression for each stylable property (docs/adr/0022) of
 * every block type — copied 1:1 from the fallback the block's `.astro`
 * already uses (`var(--brisk-override-radius, var(--radius))`), not
 * invented: this is the exact same source of truth, only declared here
 * rather than remaining visible solely inside a CSS file. It lives in
 * shared-types (not in block-registry) because BOTH `libs/block-registry`
 * (BlockDescriptor.defaultStyle, for editor-app's picker) AND
 * `apps/public-site` (resolve-theme-block-style-defaults.ts, for the
 * `/api/themes/current/block-style-defaults` endpoint) need it — the same
 * reason as `block-style-overrides.ts` in this same file, and not merely a
 * layering whim: making apps/public-site depend on `@brisk/block-registry`
 * (a package oriented around the editor's React components, not pure data)
 * caused a real TypeScript resolution conflict between Astro's
 * configuration and the registry's React test files — see this file's
 * history for the detail. shared-types does not have that problem, being
 * already a pure dependency of both apps. A reference to a theme custom
 * property (`var(--x)`) is resolved against the active theme's `theme.css`
 * on the public-site side only; a literal (`'transparent'`, `'0.5rem'`)
 * passes through unchanged.
 */
export const BLOCK_STYLE_DEFAULTS: Record<string, BlockStyleDefaults> = {
  AccordionItem: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0.75rem',
  },
  Accordion: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Banner: {
    backgroundColor: 'var(--secondary)',
    textColor: 'inherit',
    borderRadius: '12px',
    paddingX: '1.5rem',
    paddingY: '2.5rem',
  },
  Button: {
    backgroundColor: 'var(--primary)',
    textColor: 'var(--primary-foreground)',
    borderRadius: 'var(--radius)',
    paddingX: '1.25rem',
    paddingY: '0.5rem',
  },
  Code: {
    backgroundColor: 'transparent',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Column: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Columns: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Container: {
    textColor: 'inherit',
    borderRadius: '0.5rem',
  },
  Countdown: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  EmbedHtml: {
    backgroundColor: 'transparent',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  FeatureGrid: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Feature: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Form: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Hero: {
    backgroundColor: 'transparent',
    textColor: 'var(--foreground)',
    borderRadius: '0',
  },
  Heading: {
    textColor: 'inherit',
  },
  LogoStrip: {
    backgroundColor: 'transparent',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  PricingPlan: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '12px',
    paddingX: '1.5rem',
    paddingY: '1.5rem',
  },
  PricingTable: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  PromoBar: {
    backgroundColor: 'var(--primary)',
    textColor: 'var(--primary-foreground)',
    borderRadius: '0',
    paddingX: '2.5rem',
    paddingY: '0.75rem',
  },
  Quote: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Rating: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Stat: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  StatsCounter: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Tab: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '1rem',
  },
  Tabs: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  TeamMember: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Team: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Testimonial: {
    backgroundColor: 'transparent',
    textColor: 'var(--foreground)',
    borderRadius: '12px',
    paddingX: '1.5rem',
    paddingY: '1.5rem',
  },
  Testimonials: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Text: {
    textColor: 'inherit',
  },
  Timeline: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
  },
};
