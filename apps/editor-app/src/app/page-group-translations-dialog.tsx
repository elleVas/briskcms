import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { slugify, type PageTranslationRecord } from '@brisk/shared-types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ApiError } from '../lib/http-client';
import { usePageGroupTranslations } from './use-page-group-translations';

export interface PageGroupTranslationsDialogProps {
  groupId: string;
  translations: PageTranslationRecord[];
  enabledLocales: string[];
  activeLocale: string;
  onSelectLocale: (locale: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * i18n a livello di campo (see the plan) — replaces the old
 * page-translations-dialog.tsx for the new model. Narrower on purpose: no
 * "mark synced"/drift indicator (a LINKED translation can't structurally
 * drift under the shared-structure model — that was the whole point of
 * the rewrite), and switching between EXISTING translations is already
 * covered by canvas/language-switcher.tsx. This dialog's one real job is
 * the gap neither of those covers: creating a translation for a locale
 * the group doesn't have yet.
 */
export function PageGroupTranslationsDialog({
  groupId,
  translations,
  enabledLocales,
  activeLocale,
  onSelectLocale,
  open,
  onOpenChange,
}: PageGroupTranslationsDialogProps) {
  const { t } = useTranslation();
  const { createTranslation, isCreating } = usePageGroupTranslations(groupId);

  const missingLocales = enabledLocales.filter(
    (locale) =>
      !translations.some((translation) => translation.locale === locale),
  );

  const [newLocale, setNewLocale] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [error, setError] = useState('');
  const newSlug = slugify(slugInput);

  // Same "adjust state during render" resync as the old dialog — this
  // one stays mounted between opens too, only `open` toggles.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setNewLocale('');
      setSlugInput('');
      setError('');
    }
  }

  function handleSelect(locale: string) {
    onSelectLocale(locale);
    onOpenChange(false);
  }

  async function handleCreate() {
    setError('');
    try {
      const created = await createTranslation({
        locale: newLocale,
        slug: newSlug,
      });
      onOpenChange(false);
      onSelectLocale(created.locale);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? t('pages.translations.conflict')
          : String(err),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.translations.title')}</DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-1">
          {translations.map((translation) => (
            <li
              key={translation.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="font-medium uppercase">
                  {translation.locale}
                </span>
                <span className="text-muted-foreground">
                  {translation.slug}
                </span>
                <Badge
                  variant={
                    translation.status === 'published' ? 'default' : 'outline'
                  }
                >
                  {translation.status === 'published'
                    ? t('pages.list.statusPublished')
                    : t('pages.list.statusDraft')}
                </Badge>
              </span>
              {translation.locale === activeLocale ? (
                <span className="text-xs text-muted-foreground">
                  {t('pages.translations.current')}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelect(translation.locale)}
                >
                  {t('pages.translations.edit')}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {missingLocales.length > 0 && (
          <div className="flex flex-col gap-3 border-t pt-3">
            <div className="flex flex-col gap-2">
              <Label>{t('pages.translations.newLocaleLabel')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {missingLocales.map((locale) => (
                  <Button
                    key={locale}
                    type="button"
                    size="sm"
                    variant={newLocale === locale ? 'default' : 'outline'}
                    onClick={() => setNewLocale(locale)}
                  >
                    {locale.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            {newLocale && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="translation-slug">
                  {t('pages.translations.slugLabel')}
                </Label>
                <Input
                  id="translation-slug"
                  value={slugInput}
                  onChange={(event) => setSlugInput(event.target.value)}
                />
                {newSlug && (
                  <p className="text-xs text-muted-foreground">
                    {t('pages.translations.slugPreview', { slug: newSlug })}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="button"
              className="self-start"
              disabled={!newLocale || newSlug.length === 0 || isCreating}
              onClick={() => void handleCreate()}
            >
              {isCreating
                ? t('pages.translations.creating')
                : t('pages.translations.create')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
