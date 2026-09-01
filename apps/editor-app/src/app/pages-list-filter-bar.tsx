import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getLocaleDisplayName } from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { allUsersQueryOptions } from './users-queries';

export interface PagesListFilterValues {
  search: string;
  /** yyyy-mm-dd (native `<input type="date">` format), '' = unset. */
  createdAfter: string;
  createdBefore: string;
  createdBy: string;
  locale: string;
}

export const EMPTY_PAGES_LIST_FILTERS: PagesListFilterValues = {
  search: '',
  createdAfter: '',
  createdBefore: '',
  createdBy: '',
  locale: '',
};

export interface PagesListFilterBarProps {
  value: PagesListFilterValues;
  onChange: (next: PagesListFilterValues) => void;
  enabledLocales: string[];
}

// Radix Select.Item forbids an empty-string value — this sentinel stands
// in for "no filter on this dimension" in the dropdowns below, translated
// back to '' right at the boundary (see the two onValueChange handlers).
const ANY_SENTINEL = '__any__';

/**
 * Fase 4's pages-list filter bar (see the plan). No existing filter-bar
 * pattern anywhere in editor-app to copy (confirmed: neither media-grid,
 * users-list, nor forms-list has one today) — first of its kind. Date
 * range is two native `<input
 * type="date">` fields, not a calendar-popover widget: no date-picker
 * library exists in this workspace yet, and this project has deliberately
 * avoided adding UI-library dependencies for a "input + client-side
 * filter" need it can already meet natively (same reasoning
 * locale-list-editor.tsx's own doc comment gives for not using a
 * Combobox/cmdk). Creator/locale are plain Selects, not searchable
 * popovers, for the same reason — both lists are small at this product's
 * "5-15 users/pages" scale.
 */
export function PagesListFilterBar({
  value,
  onChange,
  enabledLocales,
}: PagesListFilterBarProps) {
  const { t, i18n } = useTranslation();
  const { data: usersData } = useQuery(allUsersQueryOptions());

  function set<K extends keyof PagesListFilterValues>(
    key: K,
    next: PagesListFilterValues[K],
  ): void {
    onChange({ ...value, [key]: next });
  }

  const hasActiveFilters = Object.values(value).some((v) => v !== '');

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="pages-filter-search">
          {t('pages.list.filters.search')}
        </Label>
        <Input
          id="pages-filter-search"
          className="w-48"
          value={value.search}
          onChange={(event) => set('search', event.target.value)}
          placeholder={t('pages.list.filters.searchPlaceholder')}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="pages-filter-created-after">
          {t('pages.list.filters.createdAfter')}
        </Label>
        <Input
          id="pages-filter-created-after"
          type="date"
          className="w-36"
          value={value.createdAfter}
          onChange={(event) => set('createdAfter', event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="pages-filter-created-before">
          {t('pages.list.filters.createdBefore')}
        </Label>
        <Input
          id="pages-filter-created-before"
          type="date"
          className="w-36"
          value={value.createdBefore}
          onChange={(event) => set('createdBefore', event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="pages-filter-created-by">
          {t('pages.list.filters.createdBy')}
        </Label>
        <Select
          value={value.createdBy || ANY_SENTINEL}
          onValueChange={(next) =>
            set('createdBy', next === ANY_SENTINEL ? '' : next)
          }
        >
          <SelectTrigger id="pages-filter-created-by" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_SENTINEL}>
              {t('pages.list.filters.anyCreator')}
            </SelectItem>
            {usersData?.items.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.displayName || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="pages-filter-locale">
          {t('pages.list.filters.locale')}
        </Label>
        <Select
          value={value.locale || ANY_SENTINEL}
          onValueChange={(next) =>
            set('locale', next === ANY_SENTINEL ? '' : next)
          }
        >
          <SelectTrigger id="pages-filter-locale" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_SENTINEL}>
              {t('pages.list.filters.anyLocale')}
            </SelectItem>
            {enabledLocales.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {getLocaleDisplayName(locale, i18n.language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(EMPTY_PAGES_LIST_FILTERS)}
        >
          {t('pages.list.filters.clear')}
        </Button>
      )}
    </div>
  );
}
