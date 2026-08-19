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
import { useAcceptInvite } from './use-accept-invite.js';

export interface AcceptInviteFormProps {
  token: string;
}

export function AcceptInviteForm({ token }: AcceptInviteFormProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const mutation = useAcceptInvite(token);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate(password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {t('auth.acceptInvite.title')}
          </CardTitle>
          <CardDescription>
            {t('auth.acceptInvite.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mutation.status === 'success' ? (
            <p className="text-sm text-muted-foreground">
              {t('auth.acceptInvite.doneMessage')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-password">
                  {t('auth.acceptInvite.passwordLabel')}
                </Label>
                <Input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {mutation.status === 'error' && (
                <p role="alert" className="text-sm text-destructive">
                  {t('auth.acceptInvite.error')}
                </p>
              )}
              <Button
                type="submit"
                disabled={mutation.status === 'pending'}
                className="w-full"
              >
                {mutation.status === 'pending'
                  ? t('auth.acceptInvite.submitPending')
                  : t('auth.acceptInvite.submitIdle')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
