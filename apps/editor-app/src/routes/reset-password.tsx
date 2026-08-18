import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ResetPasswordForm } from '../app/reset-password-form.js';

const resetPasswordSearchSchema = z.object({
  resetToken: z.string(),
});

export const Route = createFileRoute('/reset-password')({
  validateSearch: resetPasswordSearchSchema,
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const { resetToken } = Route.useSearch();
  return <ResetPasswordForm token={resetToken} />;
}
