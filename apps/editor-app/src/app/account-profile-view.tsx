import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  authorPathSegment,
  getLocaleDisplayName,
  isCanonicalSlug,
  slugify,
  type AccountProfile,
} from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ApiError } from '../lib/http-client';
import { PUBLIC_SITE_URL } from '../lib/public-site-url';
import { UserAvatar } from './user-avatar';
import { useAccountProfile } from './use-account-profile';

/** The server's own limit (account.schemas.ts): a few lines, not an essay. */
const BIO_MAX_CHARS = 1000;

export interface AccountProfileViewProps {
  profile: AccountProfile;
  /** The languages the site publishes — the only ones a bio is asked for in. */
  locales: string[];
}

/**
 * The signed-in person's own profile (docs/adr/0071): the name and picture
 * the editor shows, and what their author page on the site says about
 * them. Email and role are shown, not edited — an email is how they sign
 * in, and a role is an admin's to give.
 */
export function AccountProfileView({
  profile,
  locales,
}: AccountProfileViewProps) {
  const { t, i18n } = useTranslation();
  const ids = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    updateProfile,
    isSaving,
    uploadAvatar,
    removeAvatar,
    isChangingAvatar,
  } = useAccountProfile();

  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [slug, setSlug] = useState(profile.slug ?? '');
  const [bio, setBio] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      locales.map((locale) => [locale, profile.bio[locale] ?? '']),
    ),
  );
  const [error, setError] = useState('');
  const [slugError, setSlugError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  const shownName = displayName.trim() || profile.email;
  // What the address will be: the one typed; with the field emptied, the
  // one they have (an empty field keeps it); and for someone who has none
  // yet, the one the server will make from their name.
  const previewSlug = slugify(slug) || profile.slug || slugify(displayName);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSlugError('');
    // Written the way an address is, as leaving the field would have — a
    // press of Enter straight after typing does not leave it.
    const typed = slugify(slug);
    if (slug.trim() && !isCanonicalSlug(typed)) {
      setSlugError(t('account.slugInvalid'));
      return;
    }
    setSlug(typed);
    try {
      const updated = await updateProfile({
        displayName,
        slug: typed || null,
        // The languages the site does not publish are kept as they were:
        // switching a language off must not erase what was written in it.
        bio: { ...profile.bio, ...bio },
      });
      setSlug(updated.slug ?? '');
      setSavedAt(Date.now());
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSlugError(t('account.slugTaken'));
      } else if (err instanceof ApiError && err.status === 400) {
        setError(t('account.invalid'));
      } else {
        setError(t('account.saveFailed'));
      }
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setAvatarError('');
    try {
      await uploadAvatar(file);
    } catch (err) {
      setAvatarError(
        err instanceof ApiError && err.status === 413
          ? t('account.pictureTooLarge')
          : err instanceof ApiError && err.status === 400
            ? t('account.pictureNotImage')
            : t('account.pictureFailed'),
      );
    } finally {
      // The same file chosen again is a change too.
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleRemove() {
    setAvatarError('');
    try {
      await removeAvatar();
    } catch {
      setAvatarError(t('account.pictureFailed'));
    }
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-6"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t('account.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('account.intro')}</p>
      </div>

      <section
        aria-labelledby={`${ids}-picture`}
        className="flex flex-wrap items-center gap-4"
      >
        <UserAvatar
          seed={profile.id}
          name={shownName}
          imageUrl={profile.avatarUrl}
          size="lg"
        />
        <div className="flex min-w-0 flex-col gap-2">
          <h2 id={`${ids}-picture`} className="text-sm font-medium">
            {t('account.picture')}
          </h2>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isChangingAvatar}
              onClick={() => fileInput.current?.click()}
            >
              {profile.avatarUrl
                ? t('account.changePicture')
                : t('account.uploadPicture')}
            </Button>
            {profile.avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isChangingAvatar}
                onClick={() => void handleRemove()}
              >
                {t('account.removePicture')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('account.pictureHint')}
          </p>
          {avatarError && (
            <p role="alert" className="text-sm text-destructive">
              {avatarError}
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-name`}>{t('account.displayName')}</Label>
        <Input
          id={`${ids}-name`}
          value={displayName}
          maxLength={120}
          autoComplete="name"
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t('account.displayNameHint')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-slug`}>{t('account.slug')}</Label>
        <Input
          id={`${ids}-slug`}
          value={slug}
          placeholder={slugify(displayName)}
          maxLength={200}
          spellCheck={false}
          aria-invalid={slugError ? true : undefined}
          aria-describedby={`${ids}-slug-hint`}
          onChange={(event) => setSlug(event.target.value)}
          // Written the way an address is, as soon as they leave the field.
          onBlur={() =>
            setSlug((value) => (value.trim() ? slugify(value) : ''))
          }
        />
        <div id={`${ids}-slug-hint`} className="flex flex-col gap-1">
          {slugError && (
            <p role="alert" className="text-sm text-destructive">
              {slugError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t('account.slugHint')}
          </p>
          {previewSlug && (
            <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {locales.map((locale) => (
                <li key={locale} className="break-all font-mono">
                  {`${PUBLIC_SITE_URL}/${locale}/${authorPathSegment(locale)}/${previewSlug}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-medium">{t('account.bio')}</legend>
        <p className="text-xs text-muted-foreground">{t('account.bioHint')}</p>
        {locales.map((locale) => {
          const value = bio[locale] ?? '';
          return (
            <div key={locale} className="flex flex-col gap-2">
              <Label htmlFor={`${ids}-bio-${locale}`}>
                {getLocaleDisplayName(locale, i18n.language)}
              </Label>
              <Textarea
                id={`${ids}-bio-${locale}`}
                lang={locale}
                value={value}
                maxLength={BIO_MAX_CHARS}
                rows={3}
                aria-describedby={`${ids}-bio-${locale}-count`}
                onChange={(event) =>
                  setBio((current) => ({
                    ...current,
                    [locale]: event.target.value,
                  }))
                }
              />
              <p
                id={`${ids}-bio-${locale}-count`}
                className="text-end text-xs text-muted-foreground"
              >
                {t('account.bioCount', {
                  count: value.length,
                  max: BIO_MAX_CHARS,
                })}
              </p>
            </div>
          );
        })}
      </fieldset>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t('account.email')}</dt>
        <dd className="min-w-0 break-all">{profile.email}</dd>
        <dt className="text-muted-foreground">{t('account.role')}</dt>
        <dd>{t(`users.role.${profile.role}`)}</dd>
      </dl>

      <p className="text-xs text-muted-foreground">
        {t('account.authorPageNote')}
      </p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        {/* Not while a picture is on its way: the two land on the same
            person, and the save should not race the upload. */}
        <Button type="submit" disabled={isSaving || isChangingAvatar}>
          {t('account.save')}
        </Button>
        {savedAt > 0 && !isSaving && !error && !slugError && (
          <span role="status" className="text-sm text-muted-foreground">
            {t('account.saved')}
          </span>
        )}
      </div>
    </form>
  );
}
