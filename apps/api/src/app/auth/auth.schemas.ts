import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const verifyEmailBodySchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;

export const requestPasswordResetBodySchema = z.object({
  email: z.string().email(),
});
export type RequestPasswordResetBody = z.infer<
  typeof requestPasswordResetBodySchema
>;

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'La password deve avere almeno 8 caratteri'),
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

export const acceptInviteBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'La password deve avere almeno 8 caratteri'),
});
export type AcceptInviteBody = z.infer<typeof acceptInviteBodySchema>;
