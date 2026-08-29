import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { slugify } from '@brisk/shared-types';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { ApiError } from '../lib/http-client.js';
import { usePageTranslations } from './use-page-translations.js';

export interface PageTranslationsDialogProps {
  pageId: string;
  siteId: string;
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PageTranslationsDialog({
  pageId,
  siteId,
  slug,
  open,
  onOpenChange,
}: PageTranslationsDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    translations,
    isLoading,
    enabledLocales,
    createTranslation,
    isCreating,
    markSynced,
    isMarkingSynced,
  } = usePageTranslations(pageId, siteId, open);

  const [newLocale, setNewLocale] = useState('');
  const [slugInput, setSlugInput] = useState(slug);
  const [error, setError] = useState('');
  const newSlug = slugify(slugInput);

  // Same "adjust state during render" resync as SeoPanelDialog — the
  // dialog stays mounted between opens, only `open` toggles.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setNewLocale('');
      setSlugInput(slug);
      setError('');
    }
  }

  const missingLocales = enabledLocales.filter(
    (locale) =>
      !translations.some((translation) => translation.locale === locale),
  );

  async function handleCreate() {
    setError('');
    try {
      const created = await createTranslation({
        locale: newLocale,
        slug: newSlug,
      });
      onOpenChange(false);
      await navigate({ to: '/pages/$pageId', params: { pageId: created.id } });
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
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <>
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
                    {translation.hasStructuralDrift && (
                      <span
                        title={t('pages.translations.driftWarning')}
                        className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500"
                      >
                        <TriangleAlert className="size-3.5" />
                        {t('pages.translations.drift')}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {translation.hasStructuralDrift && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isMarkingSynced}
                        onClick={() => void markSynced(translation.id)}
                      >
                        {t('pages.translations.markSynced')}
                      </Button>
                    )}
                    {translation.id === pageId ? (
                      <span className="text-xs text-muted-foreground">
                        {t('pages.translations.current')}
                      </span>
                    ) : (
                      <Link
                        to="/pages/$pageId"
                        params={{ pageId: translation.id }}
                        onClick={() => onOpenChange(false)}
                        className="text-xs hover:underline"
                      >
                        {t('pages.translations.edit')}
                      </Link>
                    )}
                  </span>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
