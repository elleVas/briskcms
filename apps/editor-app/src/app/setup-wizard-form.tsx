import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../lib/http-client';
import {
  CURATED_LOCALE_CODES,
  getLocaleDisplayName,
} from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

/** Mirrors the server's own minimum (setup.schemas.ts) so the field can say so before submitting. */
const MIN_PASSWORD_LENGTH = 12;

export interface SetupWizardFormProps {
  onSubmit: (input: {
    setupToken: string;
    siteName: string;
    defaultLocale: string;
    adminEmail: string;
    adminPassword: string;
  }) => Promise<void>;
}

/**
 * The first screen a self-hosted Brisk ever shows. Deliberately short:
 * everything else — the domain, SMTP, the theme, more users — is reachable
 * and changeable from the editor afterwards, and asking for it here would
 * mean asking someone to make decisions before they have seen the product.
 *
 * The exception is the setup token, which is not a preference but a gate:
 * without it, whoever loads this page first becomes the administrator of
 * somebody else's installation. It goes first because a wrong one makes
 * the rest of the form pointless.
 *
 * No captcha, unlike login. A captcha proves "not a robot"; the token
 * proves something far stronger — that you can read this server's logs.
 * Turnstile's keys also live in the same env file the wizard exists to
 * avoid needing.
 */
export function SetupWizardForm({ onSubmit }: SetupWizardFormProps) {
  const { t } = useTranslation();
  const [setupToken, setSetupToken] = useState('');
  const [siteName, setSiteName] = useState('');
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        setupToken,
        siteName,
        defaultLocale,
        adminEmail,
        adminPassword,
      });
    } catch (err) {
      // A rejected token IS worth mapping, unlike everything else here: it
      // is the one failure the person can act on, and the action (re-read
      // the log) is not guessable. Everything else — API unreachable,
      // already set up — means "try again / reload", not "fix this field".
      setError(
        err instanceof ApiError && err.status === 401
          ? t('setup.tokenError')
          : t('setup.genericError'),
      );
      setSubmitting(false);
    }
  }

  const passwordTooShort =
    adminPassword.length > 0 && adminPassword.length < MIN_PASSWORD_LENGTH;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('setup.title')}</CardTitle>
          <CardDescription>{t('setup.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-token">{t('setup.tokenLabel')}</Label>
              <Input
                id="setup-token"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                required
                autoFocus
                autoComplete="off"
                spellCheck={false}
                aria-describedby="setup-token-hint"
              />
              <p
                id="setup-token-hint"
                className="text-muted-foreground text-xs"
              >
                {t('setup.tokenHint')}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-site-name">
                {t('setup.siteNameLabel')}
              </Label>
              <Input
                id="setup-site-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
                maxLength={120}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-locale">{t('setup.localeLabel')}</Label>
              <select
                id="setup-locale"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value)}
              >
                {CURATED_LOCALE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {getLocaleDisplayName(code)}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                {t('setup.localeHint')}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-email">{t('setup.emailLabel')}</Label>
              <Input
                id="setup-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="setup-password">{t('setup.passwordLabel')}</Label>
              <Input
                id="setup-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                aria-describedby="setup-password-hint"
              />
              <p
                id="setup-password-hint"
                className={
                  passwordTooShort
                    ? 'text-destructive text-xs'
                    : 'text-muted-foreground text-xs'
                }
              >
                {t('setup.passwordHint', { count: MIN_PASSWORD_LENGTH })}
              </p>
            </div>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? t('setup.submitPending') : t('setup.submitIdle')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
