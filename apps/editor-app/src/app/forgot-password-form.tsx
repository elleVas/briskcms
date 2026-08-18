import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { useForgotPasswordRequest } from './use-forgot-password-request.js';

export interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const { t } = useTranslation();
  const { requestReset, isSubmitting } = useForgotPasswordRequest();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await requestReset(email);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {t('auth.forgotPassword.title')}
          </CardTitle>
          <CardDescription>
            {t('auth.forgotPassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t('auth.forgotPassword.sentMessage')}
              </p>
              <Button
                variant="link"
                className="self-start px-0"
                onClick={onBackToLogin}
              >
                {t('auth.forgotPassword.backToLogin')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="forgot-email">
                  {t('auth.login.emailLabel')}
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting
                  ? t('auth.forgotPassword.submitPending')
                  : t('auth.forgotPassword.submitIdle')}
              </Button>
              <Button
                type="button"
                variant="link"
                className="self-center px-0"
                onClick={onBackToLogin}
              >
                {t('auth.forgotPassword.backToLogin')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
