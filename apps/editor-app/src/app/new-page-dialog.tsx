import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { slugify } from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ApiError } from '../lib/http-client';
import type { PageRecord } from '../lib/pages-api-client';
import { ParentPageSelect } from './parent-page-select';

export interface NewPageDialogProps {
  siteId: string;
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, parentId: string | null) => Promise<PageRecord>;
}

export function NewPageDialog({
  siteId,
  locale,
  open,
  onOpenChange,
  onCreate,
}: NewPageDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const slug = slugify(name);

  // Fresh form on every close, whatever caused it (cancel, escape, a
  // successful submit) — so the next open never shows a stale name or
  // error from the previous attempt. Done here, in the event handler
  // itself, rather than in an effect keyed on `open` (react-hooks/set
  // -state-in-effect flags synchronous setState in an effect body).
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName('');
      setParentId(null);
      setError('');
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onCreate(name, parentId);
      handleOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? t('pages.newPageDialog.slugTaken')
          : String(err),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.newPageDialog.title')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-page-name">
              {t('pages.newPageDialog.nameLabel')}
            </Label>
            <Input
              id="new-page-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
            />
            {slug && (
              <p className="text-xs text-muted-foreground">
                {t('pages.newPageDialog.slugPreview', { slug })}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-page-parent">
              {t('pages.newPageDialog.parentLabel')}
            </Label>
            <ParentPageSelect
              id="new-page-parent"
              siteId={siteId}
              locale={locale}
              value={parentId}
              onChange={setParentId}
            />
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
              onClick={() => handleOpenChange(false)}
            >
              {t('pages.newPageDialog.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || slug.length === 0}>
              {submitting
                ? t('pages.newPageDialog.creating')
                : t('pages.newPageDialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
