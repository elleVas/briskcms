import { X } from 'lucide-react';
import { useTranslation } from '../../../lib/use-translation';
import { Button } from '../../../components/ui/button';
import { useIconList } from '../../icon-list-context';

export interface IconPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function IconPickerField({ value, onChange }: IconPickerFieldProps) {
  const { t } = useTranslation();
  const { pick, resolve } = useIconList();
  const svg = value ? resolve(value) : null;

  async function handlePick() {
    const picked = await pick();
    if (picked) onChange(picked);
  }

  return (
    <div className="flex items-center gap-2">
      {svg && (
        <span
          aria-hidden="true"
          className="size-5 shrink-0"
          // The SVG comes from the icon registry, which is our own bundled
          // asset list — not from anything an author typed.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handlePick()}
      >
        {value
          ? t('canvas.pickers.icon.change')
          : t('canvas.pickers.icon.choose')}
      </Button>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('canvas.pickers.icon.remove')}
          onClick={() => onChange(null)}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
