import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ForgotPasswordForm } from '../app/forgot-password-form';
import { LoginForm } from '../app/login-form';
import { useSession } from '../app/use-session';

export const Route = createFileRoute('/login')({
  component: LoginRoute,
});

function LoginRoute() {
  const { handleLogin } = useSession();
  const navigate = useNavigate();
  const [view, setView] = useState<'login' | 'forgot-password'>('login');

  async function onLogin(
    email: string,
    password: string,
    captchaToken: string,
  ) {
    await handleLogin(email, password, captchaToken);
    await navigate({ to: '/pages' });
  }

  if (view === 'forgot-password') {
    return <ForgotPasswordForm onBackToLogin={() => setView('login')} />;
  }
  return (
    <LoginForm
      onLogin={onLogin}
      onForgotPassword={() => setView('forgot-password')}
    />
  );
}
