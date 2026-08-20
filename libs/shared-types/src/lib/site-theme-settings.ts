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

export const themeSettingsSchema = z.object({
  primaryColor: hexColorSchema.nullable(),
  secondaryColor: hexColorSchema.nullable(),
  fontFamily: z.string().min(1).nullable(),
  customCss: z.string().nullable(),
  headScript: z.string().nullable(),
  bodyScript: z.string().nullable(),
  faviconUrl: z.string().nullable(),
});
export type ThemeSettings = z.infer<typeof themeSettingsSchema>;
