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
  BackToTop: {
    backgroundColor: 'var(--primary)',
    textColor: 'var(--primary-foreground)',
    borderRadius: '50%',
    boxShadow: '0 4px 12px rgb(0 0 0 / 20%)',
  },
  Banner: {
    backgroundColor: 'var(--secondary)',
    textColor: 'inherit',
    borderRadius: '12px',
    paddingX: '1.5rem',
    paddingY: '2.5rem',
  },
  BeforeAfter: {
    borderRadius: '8px',
    borderWidth: '0',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    boxShadow: 'none',
    maxWidth: 'none',
  },
  Breadcrumb: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
    gap: '0.4rem',
  },
  Button: {
    backgroundColor: 'var(--primary)',
    textColor: 'var(--primary-foreground)',
    borderRadius: 'var(--radius)',
    paddingX: '1.25rem',
    paddingY: '0.5rem',
  },
  Callout: {
    // The tone's own colours are deliberately literal and stay put (see
    // Callout.astro) — what is stylable here is the box around them.
    borderRadius: 'var(--radius)',
    paddingX: '1.25rem',
    paddingY: '1rem',
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
    // The space between columns, which used to be a hardcoded 1.5rem
    // (ADR-0050) — this is that same value, so a row nobody has touched
    // looks exactly as it did.
    gap: '1.5rem',
  },
  Container: {
    // The preset's own value at the block's default (`padding: 'md'`) and
    // `background: 'none'` — the editor opens showing what a Container
    // actually looks like now, and the preset stays the fallback these
    // free values sit in front of (ADR-0050).
    backgroundColor: 'transparent',
    paddingX: '2rem',
    paddingY: '2rem',
    flexDirection: 'column',
    textColor: 'inherit',
    borderRadius: '0.5rem',
    // Each one is the fallback the block's own CSS already declares, so
    // the editor opens showing what the container looks like right now
    // rather than an empty box (ADR-0022's follow-up).
    borderWidth: '0',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    boxShadow: 'none',
    backgroundImage: 'none',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    overlayColor: 'transparent',
    minHeight: 'auto',
    maxWidth: 'none',
    gap: '1rem',
    contentAlign: 'stretch',
    contentJustify: 'flex-start',
  },
  Countdown: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Divider: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    maxWidth: 'none',
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
  Gallery: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
    gap: '0.5rem',
  },
  HamburgerMenu: {
    backgroundColor: 'var(--background)',
    textColor: 'inherit',
    borderRadius: '8px',
    paddingX: '1rem',
    paddingY: '1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    boxShadow: '0 8px 24px rgb(0 0 0 / 12%)',
  },
  Hero: {
    backgroundColor: 'transparent',
    textColor: 'var(--foreground)',
    borderRadius: '0',
    boxShadow: 'none',
    backgroundImage: 'none',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    overlayColor: 'transparent',
    minHeight: 'auto',
  },
  Heading: {
    textColor: 'inherit',
  },
  Icon: {
    textColor: 'currentColor',
  },
  Image: {
    borderRadius: '0',
    borderWidth: '0',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    boxShadow: 'none',
    maxWidth: 'none',
  },
  ImageSlider: {
    borderRadius: '0',
    boxShadow: 'none',
    maxWidth: 'none',
  },
  LanguageSwitcher: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
    gap: '0.5rem',
  },
  Link: {
    backgroundColor: 'transparent',
    textColor: 'var(--primary)',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  LogoStrip: {
    backgroundColor: 'transparent',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  MapEmbed: {
    borderRadius: '0',
    borderWidth: '0',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    boxShadow: 'none',
    maxWidth: 'none',
  },
  Nav: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
    gap: '1rem',
  },
  NavDropdown: {
    backgroundColor: 'var(--background)',
    textColor: 'inherit',
    borderRadius: '8px',
    paddingX: '0.75rem',
    paddingY: '0.75rem',
    gap: '0.25rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    boxShadow: '0 8px 24px rgb(0 0 0 / 12%)',
  },
  NavLink: {
    backgroundColor: 'transparent',
    textColor: 'var(--primary)',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
    gap: '0.4em',
  },
  NewsletterSignup: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
    maxWidth: '24rem',
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
  SearchBox: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
    gap: '0.5rem',
  },
  Slider: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
    gap: '1.5rem',
  },
  SocialLink: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '50%',
    paddingX: '0',
    paddingY: '0',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
  },
  SocialLinks: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
    gap: '0.75rem',
  },
  Spacer: {
    minHeight: '2rem',
    backgroundColor: 'transparent',
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
  Table: {
    // These land on the cells rather than the scroll wrapper: padding and
    // borders are what "styling a table" means (see Table.astro).
    backgroundColor: 'var(--muted)',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0.75rem',
    paddingY: '0.5rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
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
  TimelineStep: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '1rem',
    paddingY: '1.5rem',
  },
  VideoEmbed: {
    borderRadius: '0',
    borderWidth: '0',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    boxShadow: 'none',
    maxWidth: 'none',
  },
  WhatsAppButton: {
    backgroundColor: '#25d366',
    borderRadius: '50%',
    boxShadow: '0 4px 12px rgb(0 0 0 / 20%)',
  },
};
