import type { PickedMedia } from '@brisk/shared-types';
import { useTranslation } from '../../../lib/use-translation';
import { Button } from '../../../components/ui/button';
import { useMediaPicker } from '../../media-picker-context';

export interface MediaPickerFieldProps {
  value: PickedMedia | null;
  onChange: (value: PickedMedia | null) => void;
}

export function MediaPickerField({ value, onChange }: MediaPickerFieldProps) {
  const { t } = useTranslation();
  const { pick } = useMediaPicker();

  async function handlePick() {
    const picked = await pick();
    if (picked) onChange(picked);
  }

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <img
          src={value.url}
          alt=""
          className="max-w-full rounded-md border border-input"
        />
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
