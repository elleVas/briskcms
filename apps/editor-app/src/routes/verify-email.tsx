import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { VerifyEmailView } from '../app/verify-email-view';

const verifyEmailSearchSchema = z.object({
  verifyToken: z.string(),
});

export const Route = createFileRoute('/verify-email')({
  validateSearch: verifyEmailSearchSchema,
  component: VerifyEmailRoute,
});

function VerifyEmailRoute() {
  const { verifyToken } = Route.useSearch();
  return <VerifyEmailView token={verifyToken} />;
}
