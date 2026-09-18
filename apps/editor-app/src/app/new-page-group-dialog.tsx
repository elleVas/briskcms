import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PAGE_SLUG_MAX_LENGTH, slugify } from '@brisk/shared-types';
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
import { ApiError, actionErrorMessage } from '../lib/http-client';
import { collectionsQueryOptions } from './collections-queries';
import { PageParentSelect } from './page-parent-select';
import { PageTemplateSelect } from './page-template-select';
import { publishedTemplatesQueryOptions } from './reusable-sections-queries';
import type { NewPageGroupInput } from './use-page-groups-list';

export interface NewPageGroupDialogProps {
  siteId: string;
  /** Whose titles the parent choice lists — the site's default language. */
  defaultLocale: string;
  /** The collection the page is being created in, whose default template is preselected — `null` on the Pages screen. */
  collectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewPageGroupInput) => Promise<unknown>;
}

/**
 * i18n a livello di campo (see the plan) — new-page-dialog.tsx's
 * counterpart for the new PageGroup model. Still no locale choice (it
 * always seeds the site's default locale; the language switcher inside
 * the editor covers every other locale once the group exists), but the
 * page it hangs under is asked here rather than always the root
 * (docs/adr/0074).
 *
 * "Start from" lists the site's published templates (docs/adr/0072), and
 * only when there is at least one: a choice between "blank" and nothing is
 * not a choice. Inside a collection its default template is already
 * picked, because that is what the collection is for — but it is a
 * suggestion, and blank is always one click away.
 */
export function NewPageGroupDialog({
  siteId,
  defaultLocale,
  collectionId,
  open,
  onOpenChange,
  onCreate,
}: NewPageGroupDialogProps) {
  const { t } = useTranslation();
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    ...publishedTemplatesQueryOptions(siteId),
    enabled: open,
  });
  const { data: collections, isLoading: loadingCollections } = useQuery({
    ...collectionsQueryOptions(siteId),
    enabled: open && collectionId !== null,
  });
  // Until both have answered, "Start from" is not on screen yet and the
  // collection's default is unknown: Create would make a blank page that
  // the person never chose.
  const loadingChoice = loadingTemplates || loadingCollections;
  const [name, setName] = useState('');
  /** `undefined` until the person picks something — blank included — and until then the collection's default stands. */
  const [pickedTemplate, setPickedTemplate] = useState<
    string | null | undefined
  >();
  const [parentId, setParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const slug = slugify(name);
  const slugTooLong = slug.length > PAGE_SLUG_MAX_LENGTH;

  const collectionDefault = collections?.find(
    (collection) => collection.id === collectionId,
  )?.defaultTemplateId;
  // A default that is no longer on offer — deleted, say, a moment ago in
  // another tab — falls back to blank rather than selecting nothing.
  const suggested =
    templates.find((template) => template.id === collectionDefault)?.id ?? null;
  const templateId = pickedTemplate === undefined ? suggested : pickedTemplate;

  function createErrorMessage(err: unknown): string {
    if (err instanceof ApiError && err.status === 409) {
      return t('pages.newPageDialog.slugTaken');
    }
    // The page and its language are one request, and the server answers
    // 404 only for the template — gone, or never a template to start
    // from — so this cannot be mistaken for a name the address refused,
    // which is a 400.
    if (err instanceof ApiError && err.status === 404 && templateId !== null) {
      return t('pages.newPageDialog.templateUnavailable');
    }
    return actionErrorMessage(err, t('pages.newPageDialog.failed'));
  }

  // Same "always fresh on close" reasoning as new-page-dialog.tsx.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName('');
      setPickedTemplate(undefined);
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
      await onCreate({ name, templateId, parentId });
      handleOpenChange(false);
    } catch (err) {
      setError(createErrorMessage(err));
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
              // break-all: an address has no spaces to wrap at, and one
              // long enough widened the whole dialog past the screen,
              // taking Create out of reach.
              <p className="text-xs break-all text-muted-foreground">
                {t('pages.newPageDialog.slugPreview', { slug })}
              </p>
            )}
            {slugTooLong && (
              <p className="text-xs text-destructive">
                {t('pages.newPageDialog.nameTooLong', {
                  max: PAGE_SLUG_MAX_LENGTH,
                })}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-page-group-parent">
              {t('pages.parent.label')}
            </Label>
            <PageParentSelect
              id="new-page-group-parent"
              siteId={siteId}
              locale={defaultLocale}
              value={parentId}
              onChange={setParentId}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {t('pages.parent.hint')}
            </p>
          </div>
          {templates.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-page-group-template">
                {t('pages.newPageDialog.templateLabel')}
              </Label>
              <PageTemplateSelect
                id="new-page-group-template"
                templates={templates}
                value={templateId}
                onChange={setPickedTemplate}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {t('pages.newPageDialog.templateHint')}
              </p>
            </div>
          )}
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
            <Button
              type="submit"
              disabled={
                submitting || loadingChoice || slug.length === 0 || slugTooLong
              }
            >
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
