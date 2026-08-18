import { z } from 'zod';

/**
 * Site-level business info for schema.org LocalBusiness markup (see
 * docs/adr/0014) — not page content, kept separate from content-model.ts
 * for the same reason SeoMeta lives there rather than here: this describes
 * the business itself, not a page or a block.
 */
export const dayOfWeekSchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

export const openingHoursRangeSchema = z.object({
  opens: z.string().regex(/^\d{2}:\d{2}$/, 'expected HH:MM'),
  closes: z.string().regex(/^\d{2}:\d{2}$/, 'expected HH:MM'),
});
export type OpeningHoursRange = z.infer<typeof openingHoursRangeSchema>;

// One entry per weekday, each holding zero or more ranges — empty means
// closed that day, more than one supports a midday closure (e.g. a
// restaurant closed 14:00-18:00 between lunch and dinner service).
export const openingHoursDaySchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  ranges: z.array(openingHoursRangeSchema),
});
export type OpeningHoursDay = z.infer<typeof openingHoursDaySchema>;

export const openingHoursSchema = z.array(openingHoursDaySchema);
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export const businessInfoSchema = z.object({
  businessAddress: z.string().nullable(),
  businessPhone: z.string().nullable(),
  businessType: z.string().nullable(),
  openingHours: openingHoursSchema.nullable(),
});
export type BusinessInfo = z.infer<typeof businessInfoSchema>;
