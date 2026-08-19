import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { pagesQueryOptions } from './pages-queries.js';
import { collectDescendantIds } from './page-hierarchy.js';

export interface ParentPageSelectProps {
  id?: string;
  siteId: string;
  locale: string;
  // Omitted when picking a parent for a page that doesn't exist yet
  // (NewPageDialog) — nothing to exclude as "self or a descendant" in
  // that case.
  currentPageId?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

/**
 * Plain native <select>, not a dialog-based picker like PagePickerDialog —
 * at the "5-15 pagine per sito" scale a flat dropdown is simpler than a
 * modal-inside-a-modal, and this only ever needs to offer pages in the
 * page's own locale (docs/adr/0018, same constraint as NavLink). Excludes
 * the current page and its own descendants so the UI doesn't offer an
 * obviously cyclic choice — the backend (setPageParent) is still the real
 * authority via PageHierarchyCycleError.
 */
export function ParentPageSelect({
  id,
  siteId,
  locale,
  currentPageId,
  value,
  onChange,
  disabled,
}: ParentPageSelectProps) {
  const { t } = useTranslation();
  const { data } = useQuery(pagesQueryOptions(siteId, 1));
  const pages = data?.items ?? [];

  const excluded = currentPageId
    ? new Set([currentPageId, ...collectDescendantIds(pages, currentPageId)])
    : new Set<string>();
  const options = pages.filter(
    (page) => page.locale === locale && !excluded.has(page.id),
  );

  return (
    <select
      id={id}
      aria-label={id ? undefined : t('pages.parent.label')}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
      )}
    >
      <option value="">{t('pages.parent.none')}</option>
      {options.map((page) => (
        <option key={page.id} value={page.id}>
          {page.seoMeta.title || page.slug}
        </option>
      ))}
    </select>
  );
}
