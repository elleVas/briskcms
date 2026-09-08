import { useTranslation } from 'react-i18next';
import type { PickedMedia } from '@brisk/shared-types';
import { useMediaPicker } from '../../media-picker-context';

/*
 * The design system's own classes, not literal hex values (Fase 7).
 * These fields used to carry `background: '#fff'` and `color: '#18181b'`
 * inline, which is a white box with near-black text — correct in the light
 * theme and unreadable in the dark one, where the panel around them is
 * dark. A class reads the same tokens every other control does.
 */
const buttonClass =
  'inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted';
const inputClass =
  'h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export interface GalleryImageItem {
  media: PickedMedia | null;
  alt: string;
  isDecorative: boolean;
  /** Optional, and absent on every image saved before ADR-0057. */
  caption?: string;
}

export interface GalleryPickerFieldProps {
  value: GalleryImageItem[];
  onChange: (value: GalleryImageItem[]) => void;
}

/** Every slot (picker, alt text, remove) is always visible, no expansion step. */
export function GalleryPickerField({
  value,
  onChange,
}: GalleryPickerFieldProps) {
  const { pick } = useMediaPicker();
  const { t } = useTranslation();

  async function handlePickAt(index: number) {
    const picked = await pick();
    if (!picked) return;
    const next = value.slice();
    next[index] = { ...next[index], media: picked };
    onChange(next);
  }

  function handleAltChange(index: number, alt: string) {
    const next = value.slice();
    next[index] = { ...next[index], alt };
    onChange(next);
  }

  function handleDecorativeChange(index: number, isDecorative: boolean) {
    const next = value.slice();
    next[index] = { ...next[index], isDecorative };
    onChange(next);
  }

  function handleCaptionChange(index: number, caption: string) {
    const next = value.slice();
    next[index] = { ...next[index], caption };
    onChange(next);
  }

  /**
   * Moving a picture was impossible until ADR-0057 — the only way to
   * change the order of a gallery was to delete every image after the
   * one you wanted to move and add them all back.
   */
  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleAdd() {
    onChange([
      ...value,
      { media: null, alt: '', isDecorative: false, caption: '' },
    ]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/*
        The key includes the picked media's id, so a row keeps its
        identity across a reorder — with a bare index, moving a row would
        leave React reusing the previous row's input state for it, and the
        caption you just typed would appear on the wrong picture.
      */}
      {value.map((item, index) => (
        <div
          key={`${item.media?.mediaId ?? 'empty'}-${index}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 8,
            border: '1px solid var(--border)',
            borderRadius: 4,
          }}
        >
          {item.media && (
            <img
              src={item.media.url}
              alt=""
              style={{
                maxWidth: '100%',
                borderRadius: 4,
                border: '1px solid var(--border)',
              }}
            />
          )}
          <button
            type="button"
            onClick={() => void handlePickAt(index)}
            className={`${buttonClass} self-start`}
          >
            {item.media ? t('gallery.field.change') : t('gallery.field.pick')}
          </button>
          <input
            type="text"
            placeholder={t('gallery.field.alt')}
            value={item.alt}
            disabled={item.isDecorative}
            onChange={(event) => handleAltChange(index, event.target.value)}
            className={inputClass}
          />
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={item.isDecorative}
              onChange={(event) =>
                handleDecorativeChange(index, event.target.checked)
              }
            />
            {t('gallery.field.decorative')}
          </label>
          {!item.isDecorative && item.alt.trim().length === 0 && (
            <p style={{ fontSize: 12, color: '#b45309', margin: 0 }}>
              {t('gallery.field.altRequired')}
            </p>
          )}
          <input
            type="text"
            placeholder={t('gallery.field.caption')}
            value={item.caption ?? ''}
            onChange={(event) => handleCaptionChange(index, event.target.value)}
            className={inputClass}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => handleMove(index, -1)}
              disabled={index === 0}
              aria-label={t('gallery.field.moveUp')}
              className={buttonClass}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => handleMove(index, 1)}
              disabled={index === value.length - 1}
              aria-label={t('gallery.field.moveDown')}
              className={buttonClass}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className={buttonClass}
            >
              {t('gallery.field.remove')}
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={handleAdd} className={buttonClass}>
        {t('gallery.field.add')}
      </button>
    </div>
  );
}
