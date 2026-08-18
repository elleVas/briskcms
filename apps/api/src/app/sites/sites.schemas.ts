import { z } from 'zod';
import { openingHoursSchema } from '@brisk/shared-types';
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
