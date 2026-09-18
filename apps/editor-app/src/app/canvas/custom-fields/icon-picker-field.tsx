import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../lib/use-translation';
import { Button } from '../../../components/ui/button';
import { useIconList } from '../../icon-list-context';
import { brandIconQueryOptions } from '../../theme-icons-queries';
import { useActiveThemeName } from '../../use-active-theme-name';

/**
 * The markup that previews an icon value. A logo is fetched on its own:
 * the interface set the provider preloads does not hold the logos, so a
 * logo chosen yesterday used to show no preview at all today.
 */
function useIconPreview(value: string | null): string | null {
  const { resolve } = useIconList();
  const isBrand = value?.startsWith('brand:') ?? false;
  const { data: brand } = useQuery(
    brandIconQueryOptions(useActiveThemeName(), isBrand ? (value ?? '') : ''),
  );
  if (!value) return null;
  return isBrand ? (brand?.svg ?? null) : resolve(value);
}

export interface IconPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function IconPickerField({ value, onChange }: IconPickerFieldProps) {
  const { t } = useTranslation();
  const { pick } = useIconList();
  const svg = useIconPreview(value);

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
          // asset list, or from mediaIconSvg, which escapes the one address
          // it holds — never from anything an author typed as markup.
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
