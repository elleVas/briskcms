import type { MediaKind, PickedMedia } from '@brisk/shared-types';
import { useTranslation } from '../../../lib/use-translation';
import { Button } from '../../../components/ui/button';
import { useMediaPicker } from '../../media-picker-context';

export interface MediaPickerFieldProps {
  value: PickedMedia | null;
  onChange: (value: PickedMedia | null) => void;
}

/**
 * The file a block field holds, and the button that changes it.
 *
 * One component for every kind, told which one it is: the picker is
 * locked to that kind, and the preview is the element that kind is shown
 * with. It used to be an `<img>` for everything, so a video field showed a
 * broken picture of the video it held.
 */
function KindPickerField({
  value,
  onChange,
  kind,
}: MediaPickerFieldProps & { kind: MediaKind }) {
  const { t } = useTranslation();
  const { pick } = useMediaPicker();

  async function handlePick() {
    const picked = await pick({ kind });
    if (picked) onChange(picked);
  }

  const previewClass = 'max-w-full rounded-md border border-input';

  return (
    <div className="flex flex-col gap-2">
      {value && kind === 'image' && (
        <img src={value.url} alt="" className={previewClass} />
      )}
      {value && kind === 'video' && (
        // `metadata` so the first frame shows without downloading the clip.
        <video
          src={value.url}
          preload="metadata"
          muted
          className={previewClass}
        />
      )}
      {value && kind === 'audio' && (
        <audio src={value.url} preload="none" controls className="w-full" />
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => void handlePick()}
      >
        {value
          ? t('canvas.pickers.media.change')
          : t('canvas.pickers.media.choose')}
      </Button>
    </div>
  );
}

/** `control: 'media'` — an image. The name predates video and audio, and theme descriptors already rely on it meaning this. */
export function MediaPickerField(props: MediaPickerFieldProps) {
  return <KindPickerField {...props} kind="image" />;
}

/** `control: 'video'`. */
export function VideoPickerField(props: MediaPickerFieldProps) {
  return <KindPickerField {...props} kind="video" />;
}

/** `control: 'audio'`. */
export function AudioPickerField(props: MediaPickerFieldProps) {
  return <KindPickerField {...props} kind="audio" />;
}
