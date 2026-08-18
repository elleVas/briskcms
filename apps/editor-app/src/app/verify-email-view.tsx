import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card.js';
import { useVerifyEmail } from './use-verify-email.js';

export interface VerifyEmailViewProps {
  token: string;
}

export function VerifyEmailView({ token }: VerifyEmailViewProps) {
  const { t } = useTranslation();
  const status = useVerifyEmail(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {t('auth.verifyEmail.title')}
          </CardTitle>
          <CardDescription>{t('auth.verifyEmail.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {(status === 'idle' || status === 'pending') && (
            <p className="text-sm text-muted-foreground">
              {t('auth.verifyEmail.pending')}
            </p>
          )}
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              {t('auth.verifyEmail.success')}
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {t('auth.verifyEmail.error')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
