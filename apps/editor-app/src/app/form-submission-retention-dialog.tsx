import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { SiteRecord } from '@brisk/shared-types';
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
import { siteQueryOptions } from './site-queries';
import { useResetFormOnOpen } from './use-reset-form-on-open';
import { useSiteFormSubmissionRetention } from './use-site-form-submission-retention';

export interface FormSubmissionRetentionDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormSubmissionRetentionFormValues {
  // Kept as a string, not number | null, for the same reason every other
  // controlled text/number input in this codebase is: an <input> element's
  // own value is always a string, and '' (empty, "keep forever") isn't a
  // valid `number` to hold in form state either way.
  retentionDays: string;
}

function toFormValues(site: SiteRecord): FormSubmissionRetentionFormValues {
  return {
    retentionDays:
      site.formSubmissionRetentionDays === null
        ? ''
        : String(site.formSubmissionRetentionDays),
  };
}

export function FormSubmissionRetentionDialog({
  siteId,
  open,
  onOpenChange,
}: FormSubmissionRetentionDialogProps) {
  const { t } = useTranslation();
  const { data: site } = useQuery({
    ...siteQueryOptions(siteId),
    enabled: open,
  });
  const { updateFormSubmissionRetention, isSaving } =
    useSiteFormSubmissionRetention(siteId);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset } =
    useForm<FormSubmissionRetentionFormValues>({
      defaultValues: { retentionDays: '' },
    });
  useResetFormOnOpen(open, site, reset, (currentSite) => {
    setError('');
    return toFormValues(currentSite);
  });

  async function onSubmit(values: FormSubmissionRetentionFormValues) {
    setError('');
    const trimmed = values.retentionDays.trim();
    if (trimmed !== '') {
      const parsed = Number(trimmed);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setError(t('formSubmissionRetention.invalidValue'));
        return;
      }
    }
    try {
      await updateFormSubmissionRetention({
        formSubmissionRetentionDays: trimmed === '' ? null : Number(trimmed),
      });
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('formSubmissionRetention.title')}</DialogTitle>
        </DialogHeader>
        {!site ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                {t('formSubmissionRetention.description')}
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="retentionDays">
                  {t('formSubmissionRetention.fieldLabel')}
                </Label>
                <Input
                  id="retentionDays"
                  type="number"
                  min={1}
                  step={1}
                  placeholder={t('formSubmissionRetention.placeholder')}
                  {...register('retentionDays')}
                />
                <span className="text-xs text-muted-foreground">
                  {t('formSubmissionRetention.hint')}
                </span>
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
                {t('formSubmissionRetention.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? t('formSubmissionRetention.saving')
                  : t('formSubmissionRetention.save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
