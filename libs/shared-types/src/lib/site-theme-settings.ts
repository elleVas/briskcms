import { z } from 'zod';

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color, e.g. #18181b');

/**
 * Curated choices an admin can pick without typing anything (docs/adr/0021)
 * — `themeFontFamily` itself is a free string, not restricted to this list:
 * an admin can also type any Google Fonts family name directly. `system`
 * loads nothing external, using the OS/browser's own UI font stack; every
 * other entry's `googleFontsFamily` is the exact family[:wght@...] segment
 * public-site builds the fonts.googleapis.com <link> from.
 */
export const CURATED_THEME_FONTS = [
  { value: 'system', label: 'Sistema', googleFontsFamily: null },
  {
    value: 'inter',
    label: 'Inter',
    googleFontsFamily: 'Inter:wght@400;500;600;700',
  },
  {
    value: 'roboto',
    label: 'Roboto',
    googleFontsFamily: 'Roboto:wght@400;500;700',
  },
  {
    value: 'poppins',
    label: 'Poppins',
    googleFontsFamily: 'Poppins:wght@400;500;600;700',
  },
  {
    value: 'lora',
    label: 'Lora',
    googleFontsFamily: 'Lora:wght@400;500;600;700',
  },
  {
    value: 'playfair-display',
    label: 'Playfair Display',
    googleFontsFamily: 'Playfair+Display:wght@400;600;700',
  },
  {
    value: 'jetbrains-mono',
    label: 'JetBrains Mono',
    googleFontsFamily: 'JetBrains+Mono:wght@400;500;700',
  },
] as const;

// Bare hostname, optional `*.` wildcard subdomain prefix, no scheme/path —
// CSP source-list shape (see content-security-policy.ts's own hardcoded
// origins for the pattern this mirrors). Always rendered with an assumed
// `https://` prefix at CSP-build time; never accept a scheme here so an
// admin can't smuggle `http://` (or anything else) into the header.
export const trackerDomainSchema = z
  .string()
  .regex(
    /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i,
    'Must be a bare domain, e.g. static.hotjar.com or *.hotjar.io — no https:// prefix, no path',
  );

export const trackerDomainEntrySchema = z.object({
  // For the admin's own reference in the list UI — never rendered into the
  // CSP header itself, just labels which vendor a domain belongs to.
  label: z.string().min(1).max(60),
  domain: trackerDomainSchema,
});
export type TrackerDomainEntry = z.infer<typeof trackerDomainEntrySchema>;

export const themeSettingsSchema = z.object({
  primaryColor: hexColorSchema.nullable(),
  secondaryColor: hexColorSchema.nullable(),
  fontFamily: z.string().min(1).nullable(),
  customCss: z.string().nullable(),
  headScript: z.string().nullable(),
  bodyScript: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  // Two-gate composition (docs/adr/0021): a theme's own theme.json
  // `allowStyleOverrides` is the ceiling a site can never raise past — this
  // flag is the day-to-day switch *below* that ceiling, controlled by
  // whoever edits Site settings. Both must allow overrides for any Tier 1
  // field above to actually render; either one being false means "ignore
  // everything in this object except this flag itself".
  overridesEnabled: z.boolean(),
  // ADR-0031's tracker whitelist: domains a site owner's own head/body
  // script needs to talk to beyond the hardcoded GTM/GA4/Meta Pixel
  // allowlist (content-security-policy.ts). Capped well above any realistic
  // legitimate use so the CSP header itself can't grow unbounded.
  allowedTrackerDomains: z.array(trackerDomainEntrySchema).max(20),
});
export type ThemeSettings = z.infer<typeof themeSettingsSchema>;
