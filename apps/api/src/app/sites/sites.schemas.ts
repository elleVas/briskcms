import { z } from 'zod';
import { openingHoursSchema } from '@brisk/shared-types';

export const updateBusinessInfoBodySchema = z.object({
  businessAddress: z.string().nullable(),
  businessPhone: z.string().nullable(),
  businessType: z.string().nullable(),
  openingHours: openingHoursSchema.nullable(),
});
export type UpdateBusinessInfoBody = z.infer<
  typeof updateBusinessInfoBodySchema
>;
