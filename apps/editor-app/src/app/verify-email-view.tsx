import { useEffect, useState } from 'react';
import { verifyEmail } from '../lib/pages-api-client.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card.js';

export interface VerifyEmailViewProps {
  token: string;
}

type Status = 'pending' | 'success' | 'error';

export function VerifyEmailView({ token }: VerifyEmailViewProps) {
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Verifica email</CardTitle>
          <CardDescription>Conferma del tuo indirizzo email</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'pending' && (
            <p className="text-sm text-muted-foreground">
              Verifica in corso...
            </p>
          )}
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              Email verificata con successo.
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              Il link non è valido o è scaduto. Richiedi un nuovo link di
              verifica dal tuo account.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
