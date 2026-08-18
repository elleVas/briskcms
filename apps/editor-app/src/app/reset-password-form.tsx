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
import { useResetPassword } from './use-reset-password.js';

export interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const mutation = useResetPassword(token);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(newPassword);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {t('auth.resetPassword.title')}
          </CardTitle>
          <CardDescription>
            {t('auth.resetPassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mutation.status === 'success' ? (
            <p className="text-sm text-muted-foreground">
              {t('auth.resetPassword.doneMessage')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">
                  {t('auth.resetPassword.newPasswordLabel')}
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {mutation.status === 'error' && (
                <p role="alert" className="text-sm text-destructive">
                  {t('auth.resetPassword.error')}
                </p>
              )}
              <Button
                type="submit"
                disabled={mutation.status === 'pending'}
                className="w-full"
              >
                {mutation.status === 'pending'
                  ? t('auth.resetPassword.submitPending')
                  : t('auth.resetPassword.submitIdle')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
