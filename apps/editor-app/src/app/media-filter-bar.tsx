import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import type { MediaFilters } from '../lib/media-api-client';

export interface MediaFilterBarProps {
  value: MediaFilters;
  onChange: (next: MediaFilters) => void;
}

/** "Everything" first, then the three things a file can be (ADR-0054). */
const KIND_OPTIONS = [
  { value: undefined, labelKey: 'media.filters.kindAll' },
  { value: 'image' as const, labelKey: 'media.filters.kindImage' },
  { value: 'video' as const, labelKey: 'media.filters.kindVideo' },
  { value: 'audio' as const, labelKey: 'media.filters.kindAudio' },
] satisfies readonly {
  value: MediaFilters['kind'];
  labelKey:
    | 'media.filters.kindAll'
    | 'media.filters.kindImage'
    | 'media.filters.kindVideo'
    | 'media.filters.kindAudio';
}[];

/**
 * Finding a file in the library.
 *
 * There was nothing: no search, no filter, no sort — with nineteen files it
 * was already a grid of dark rectangles telling you nothing, and every
 * screenshot in the docs is a black image, so they were nineteen identical
 * squares. The name was not written anywhere either, so the only way to
 * find one was to recognise a thumbnail.
 *
 * Both controls narrow the query the SERVER answers, not the page that
 * came back — see MediaFilter. A filter applied on the client would search
 * the newest twenty-four files and stay silent about the rest, which is
 * worse than no search at all.
 */
export function MediaFilterBar({ value, onChange }: MediaFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex min-w-56 flex-1 items-center">
        <span className="sr-only">{t('media.filters.searchLabel')}</span>
        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
        <Input
          type="search"
          className="pl-8"
          value={value.search ?? ''}
          placeholder={t('media.filters.searchPlaceholder')}
          onChange={(event) =>
            onChange({ ...value, search: event.target.value })
          }
        />
      </label>
      <div
        role="radiogroup"
        aria-label={t('media.filters.kindLabel')}
        className="flex items-center gap-0.5 rounded-md border p-0.5"
      >
        {KIND_OPTIONS.map((option) => (
          <button
            key={option.labelKey}
            type="button"
            role="radio"
            aria-checked={value.kind === option.value}
            onClick={() => onChange({ ...value, kind: option.value })}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value.kind === option.value && 'bg-muted text-foreground',
            )}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
