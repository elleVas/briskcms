import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { PageGroupListItemRecord } from '@brisk/shared-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { pageGroupsQueryOptions } from './page-groups-queries';

/** Radix Select cannot hold an empty value, and "at the top level" is a real answer. */
const ROOT = '__root__';

export interface PageParentSelectProps {
  id: string;
  siteId: string;
  /** Which language's titles are listed — the addresses differ per language, the tree does not. */
  locale: string;
  /** `null` for a page that hangs at the top level. */
  value: string | null;
  onChange: (parentId: string | null) => void;
  /**
   * Never offered as a destination: the page being moved, and everything
   * under it. A ring in the tree is refused by the API anyway — this is so
   * nobody is invited to ask for one.
   */
  excludeSubtreeOf?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Which page a page hangs from — asked when one is created, and again
 * when one moves (docs/adr/0074).
 *
 * A flat select rather than a tree: a Brisk site is a handful of pages
 * (the "5-15 pagine" this codebase assumes throughout), and the choice is
 * one click deep. Titles carry their depth as indentation so two pages
 * with the same name in different branches are still told apart.
 */
export function PageParentSelect({
  id,
  siteId,
  locale,
  value,
  onChange,
  excludeSubtreeOf,
  disabled,
  className,
}: PageParentSelectProps) {
  const { t } = useTranslation();
  // One page of the list: past it a site is far beyond the handful of
  // pages this select is shaped for, and the answer would be a tree
  // screen rather than a longer dropdown.
  const { data } = useQuery(pageGroupsQueryOptions(siteId, 1, { locale }));
  const candidates = offerableParents(
    data?.items ?? [],
    locale,
    excludeSubtreeOf,
  );
  const current =
    value !== null && candidates.some((page) => page.id === value)
      ? value
      : ROOT;

  return (
    <Select
      value={current}
      onValueChange={(next) => onChange(next === ROOT ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ROOT}>{t('pages.parent.none')}</SelectItem>
        {candidates.map((page) => (
          <SelectItem key={page.id} value={page.id}>
            {' '.repeat(page.depth * 2)}
            {page.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ParentOption {
  id: string;
  title: string;
  depth: number;
}

/**
 * The pages a page may hang from, parents before children, with the
 * excluded branch removed whole — a page cannot move inside its own
 * child, so offering the child is offering an error.
 */
function offerableParents(
  items: PageGroupListItemRecord[],
  locale: string,
  excludeSubtreeOf: string | undefined,
): ParentOption[] {
  const byParent = new Map<string | null, PageGroupListItemRecord[]>();
  for (const item of items) {
    const siblings = byParent.get(item.parentId) ?? [];
    siblings.push(item);
    byParent.set(item.parentId, siblings);
  }
  const options: ParentOption[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const item of byParent.get(parentId) ?? []) {
      if (item.id === excludeSubtreeOf) continue;
      const here =
        item.translations.find(
          (translation) => translation.locale === locale,
        ) ?? item.translations[0];
      options.push({
        id: item.id,
        title: here?.title || here?.slug || '—',
        depth,
      });
      walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  return options;
}
