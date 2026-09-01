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

export interface NewPageGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<unknown>;
}

/**
 * i18n a livello di campo (see the plan) — new-page-dialog.tsx's
 * counterpart for the new PageGroup model. Deliberately simpler: no
 * parent picker (every new group starts at root, see
 * use-page-groups-list.ts's own comment on why — a real, tracked
 * follow-up, not silently dropped) and no locale choice (always seeds the
 * site's default locale; the language switcher inside the editor covers
 * every other locale once the group exists).
 */
export function NewPageGroupDialog({
  open,
  onOpenChange,
  onCreate,
}: NewPageGroupDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const slug = slugify(name);

  // Same "always fresh on close" reasoning as new-page-dialog.tsx.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName('');
      setError('');
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onCreate(name);
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
            <Label htmlFor="new-page-group-name">
              {t('pages.newPageDialog.nameLabel')}
            </Label>
            <Input
              id="new-page-group-name"
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
