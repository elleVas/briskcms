import { z } from 'zod';

const userRoleSchema = z.enum(['admin', 'publisher', 'editor']);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const inviteUserBodySchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  role: userRoleSchema,
});
export type InviteUserBody = z.infer<typeof inviteUserBodySchema>;

export const updateUserRoleBodySchema = z.object({
  role: userRoleSchema,
});
export type UpdateUserRoleBody = z.infer<typeof updateUserRoleBodySchema>;

export const setUserActiveBodySchema = z.object({
  isActive: z.boolean(),
});
export type SetUserActiveBody = z.infer<typeof setUserActiveBodySchema>;
