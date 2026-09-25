import { z } from 'zod';
import { userRoleSchema } from './author';

/**
 * A person with access to the editor, as the users screen sees them
 * (docs/adr/0026). The avatar arrives as a URL the storage adapter
 * resolved, never the storage key it sits under.
 */
export const userRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  /** The person's author address, or `null` until they have a name (docs/adr/0071). */
  slug: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: userRoleSchema,
  isActive: z.boolean(),
  emailVerifiedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type UserRecord = z.infer<typeof userRecordSchema>;

export const paginatedUsersSchema = z.object({
  items: z.array(userRecordSchema),
  total: z.number(),
});
export type PaginatedUsers = z.infer<typeof paginatedUsersSchema>;
