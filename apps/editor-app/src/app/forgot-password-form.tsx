import { useState, type FormEvent } from 'react';
import { requestPasswordReset } from '../lib/pages-api-client.js';
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

export interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // Ignored on purpose: always show the same confirmation, whether
      // the request succeeded, the email didn't match an account, or the
      // call itself failed — same anti-enumeration principle the backend
      // already enforces (see requestPasswordReset use-case).
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Password dimenticata</CardTitle>
          <CardDescription>
            Inserisci la tua email per ricevere un link di reimpostazione
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Se l&apos;indirizzo esiste, ti abbiamo inviato un&apos;email con
                le istruzioni per reimpostare la password.
              </p>
              <Button
                variant="link"
                className="self-start px-0"
                onClick={onBackToLogin}
              >
                Torna al login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Invio in corso...' : 'Invia link di reset'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="self-center px-0"
                onClick={onBackToLogin}
              >
                Torna al login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
