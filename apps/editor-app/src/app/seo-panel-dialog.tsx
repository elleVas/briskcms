import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaPicker } from '@brisk/block-registry';
import type { SeoMeta } from '@brisk/shared-types';
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
import { usePageSeo } from './use-page-seo.js';

export interface SeoPanelDialogProps {
  pageId: string;
  seoMeta: SeoMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SeoPanelDialog({
  pageId,
  seoMeta,
  open,
  onOpenChange,
}: SeoPanelDialogProps) {
  const { t } = useTranslation();
  const { pick } = useMediaPicker();
  const { updateSeoMeta, isSaving } = usePageSeo(pageId);

  // Lazy-initialized from the current seoMeta, not '': covers the dialog
  // ever mounting already open, not just the toggle-while-mounted case
  // the block below handles.
  const [title, setTitle] = useState(seoMeta.title);
  const [description, setDescription] = useState(seoMeta.description);
  const [canonical, setCanonical] = useState(seoMeta.canonical ?? '');
  const [ogImage, setOgImage] = useState(seoMeta.ogTags?.['image'] ?? '');
  const [error, setError] = useState('');

  // Re-syncs from the latest seoMeta every time the dialog opens — it
  // stays mounted between opens, only `open` toggles. Adjusts state
  // during render (comparing against the last render's `open`) rather
  // than in a useEffect, per
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setTitle(seoMeta.title);
      setDescription(seoMeta.description);
      setCanonical(seoMeta.canonical ?? '');
      setOgImage(seoMeta.ogTags?.['image'] ?? '');
      setError('');
    }
  }

  async function handlePickOgImage() {
    const picked = await pick();
    if (picked) setOgImage(picked.url);
  }

  async function handleSubmit() {
    setError('');
    try {
      await updateSeoMeta({
        title,
        description,
        ...(canonical.trim() && { canonical: canonical.trim() }),
        ...(ogImage.trim() && { ogTags: { image: ogImage.trim() } }),
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
          <DialogTitle>{t('pages.seo.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="seo-title">{t('pages.seo.titleLabel')}</Label>
            <Input
              id="seo-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="seo-description">
              {t('pages.seo.descriptionLabel')}
            </Label>
            <Input
              id="seo-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('pages.seo.ogImageLabel')}</Label>
            {ogImage && (
              <img
                src={ogImage}
                alt=""
                className="max-w-full rounded-md border"
              />
            )}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => void handlePickOgImage()}
            >
              {ogImage
                ? t('pages.seo.changeOgImage')
                : t('pages.seo.chooseOgImage')}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="seo-canonical">
              {t('pages.seo.canonicalLabel')}
            </Label>
            <Input
              id="seo-canonical"
              value={canonical}
              onChange={(event) => setCanonical(event.target.value)}
              placeholder="https://..."
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
            {t('pages.seo.cancel')}
          </Button>
          <Button
            type="button"
            disabled={isSaving || title.trim().length === 0}
            onClick={() => void handleSubmit()}
          >
            {isSaving ? t('pages.seo.saving') : t('pages.seo.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
