import { z } from 'zod';
import {
  localeSettingsSchema,
  openingHoursSchema,
  themeSettingsSchema,
  updateThemeTokensBodySchema as sharedUpdateThemeTokensBodySchema,
} from '@brisk/shared-types';
import { domainSchema } from '../public-pages/public-pages.schemas.js';

export const updateBusinessInfoBodySchema = z.object({
  businessAddress: z.string().nullable(),
  businessPhone: z.string().nullable(),
  businessType: z.string().nullable(),
  openingHours: openingHoursSchema.nullable(),
});
export type UpdateBusinessInfoBody = z.infer<
  typeof updateBusinessInfoBodySchema
>;

// Same hostname validation as the public read path (public-pages.schemas.ts)
// — a site's own `domain` must be a plausible hostname for the exact same
// reason a request's Host header is validated there, just checked at write
// time here instead of read time.
export const updateGeneralSettingsBodySchema = z.object({
  name: z.string().min(1),
  domain: domainSchema.nullable(),
});
export type UpdateGeneralSettingsBody = z.infer<
  typeof updateGeneralSettingsBodySchema
>;

export const updateSeoSettingsBodySchema = z.object({
  searchEngineIndexingEnabled: z.boolean(),
});
export type UpdateSeoSettingsBody = z.infer<typeof updateSeoSettingsBodySchema>;

// Reuses @brisk/shared-types' schema wholesale (docs/adr/0017) — it already
// encodes the one real invariant (defaultLocale must be one of
// enabledLocales), no reason to redeclare it here.
export const updateLocaleSettingsBodySchema = localeSettingsSchema;
export type UpdateLocaleSettingsBody = z.infer<
  typeof updateLocaleSettingsBodySchema
>;

// Reuses @brisk/shared-types' schema wholesale (docs/adr/0021) — same
// reasoning as locale settings above, the validation rules (hex color
// format) live once, shared between this write path and any future reader.
export const updateThemeSettingsBodySchema = themeSettingsSchema;
export type UpdateThemeSettingsBody = z.infer<
  typeof updateThemeSettingsBodySchema
>;

// Reuses @brisk/shared-types' schema wholesale — same reasoning as theme
// settings above (Global Styles Editor, Fase 2a del piano editor visuale
// parte 2).
export const updateThemeTokensBodySchema = sharedUpdateThemeTokensBodySchema;
export type UpdateThemeTokensBody = z.infer<typeof updateThemeTokensBodySchema>;
