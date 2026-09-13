import { useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import type { MediaKind } from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { useMediaLibrary } from './use-media-library';

/**
 * What the file chooser suggests, and only when the kind is already known.
 *
 * The library takes any file (ADR-0070), so outside a folder there is
 * nothing to suggest. Inside a picker for a video field, or the Images
 * folder, `image/*` spares somebody choosing a PDF that would then not
 * appear in the list they are looking at. Documents and other files have
 * no MIME wildcard worth offering.
 */
const ACCEPT_BY_KIND: Partial<Record<MediaKind, string>> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
};

export interface MediaUploadButtonProps {
  siteId: string;
  kind?: MediaKind;
  /** The failure, as text: where it is shown is the screen's decision, not the button's. */
  onError: (message: string) => void;
}

/**
 * The upload button and the hidden file input behind it.
 *
 * Its own component since the library opened onto folders: the folder
 * screen has no grid, and uploading is still the first thing somebody
 * does there. It used to live inside MediaGrid, which would have meant
 * a second copy.
 */
export function MediaUploadButton({
  siteId,
  kind,
  onError,
}: MediaUploadButtonProps) {
  const { t } = useTranslation();
  const { uploadMedia, isUploading } = useMediaLibrary(siteId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so picking the same file again later still fires onChange.
    event.target.value = '';
    if (!file) return;
    onError('');
    try {
      await uploadMedia(file);
    } catch (err) {
      onError(String(err));
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={kind ? ACCEPT_BY_KIND[kind] : undefined}
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? t('media.grid.uploading') : t('media.grid.upload')}
      </Button>
    </>
  );
}

/**
 * The warning the owner asked for, in place of a check we do not make
 * (ADR-0070): any file is taken, nothing is scanned, and the one
 * protection there is — whatever is not an image, a video or an audio
 * file downloads instead of opening — is not a reason to upload something
 * you do not trust.
 */
export function MediaUploadWarning() {
  const { t } = useTranslation();
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {t('media.grid.uploadWarning')}
    </p>
  );
}
