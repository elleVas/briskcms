import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { FormDto } from '../lib/forms-api-client.js';

export interface NewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<FormDto>;
}

export function NewFormDialog({
  open,
  onOpenChange,
  onCreate,
}: NewFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Same reasoning as NewPageDialog: fresh form on every close, done in the
  // event handler rather than an effect (react-hooks/set-state-in-effect).
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
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('forms.newFormDialog.title')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-form-name">
              {t('forms.newFormDialog.nameLabel')}
            </Label>
            <Input
              id="new-form-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
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
              {t('forms.newFormDialog.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitting || name.trim().length === 0}
            >
              {submitting
                ? t('forms.newFormDialog.creating')
                : t('forms.newFormDialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
