import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { slugify } from '@brisk/shared-types';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { ApiError } from '../lib/http-client.js';
import type { PageDto, PageSummaryDto } from '../lib/pages-api-client.js';

export interface DuplicatePageDialogProps {
  sourcePage: PageSummaryDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDuplicate: (input: {
    slug: string;
    title: string;
    description: string;
  }) => Promise<PageDto>;
}

function defaultCopySlug(sourceSlug: string): string {
  return slugify(`${sourceSlug}-copia`);
}

/**
 * Un dialog di duplicazione pagina, non un semplice "clicca e duplica" —
 * l'utente vede subito titolo/slug/descrizione della copia e può
 * modificarli prima di crearla (stesso principio di NewPageDialog: mai
 * partire da uno stato che poi va sistemato altrove). Il contenuto della
 * sorgente viene copiato invariato dal backend (vedi duplicate-page.use-
 * case.ts) — qui si edita solo ciò che DEVE cambiare per forza (lo slug,
 * essendo la copia sullo stesso sito/lingua della sorgente).
 */
export function DuplicatePageDialog({
  sourcePage,
  open,
  onOpenChange,
  onDuplicate,
}: DuplicatePageDialogProps) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(sourcePage.seoMeta.title);
  const [slug, setSlug] = useState(defaultCopySlug(sourcePage.slug));
  const [description, setDescription] = useState(
    sourcePage.seoMeta.description,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Stesso pattern di SeoPanelDialog: il dialog resta montato tra un'apertura
  // e l'altra, quindi risincronizza i campi dalla sorgente corrente solo
  // quando `open` passa a true — "aggiusta lo stato durante il render",
  // niente useEffect (vedi https://react.dev/learn/you-might-not-need-an-effect).
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setTitle(sourcePage.seoMeta.title);
      setSlug(defaultCopySlug(sourcePage.slug));
      setDescription(sourcePage.seoMeta.description);
      setError('');
    }
  }

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await onDuplicate({ slug, title, description });
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? t('pages.duplicateDialog.slugTaken')
          : String(err),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.duplicateDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="duplicate-page-title">
              {t('pages.duplicateDialog.titleLabel')}
            </Label>
            <Input
              id="duplicate-page-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="duplicate-page-slug">
              {t('pages.duplicateDialog.slugLabel')}
            </Label>
            <Input
              id="duplicate-page-slug"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="duplicate-page-description">
              {t('pages.duplicateDialog.descriptionLabel')}
            </Label>
            <Input
              id="duplicate-page-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('pages.duplicateDialog.cancel')}
          </Button>
          <Button
            type="button"
            disabled={
              submitting || slug.length === 0 || title.trim().length === 0
            }
            onClick={() => void handleSubmit()}
          >
            {submitting
              ? t('pages.duplicateDialog.duplicating')
              : t('pages.duplicateDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
