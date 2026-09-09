import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../lib/use-translation';
import { siteQueryOptions } from '../../site-queries';
import {
  taxonomiesQueryOptions,
  termsQueryOptions,
} from '../../taxonomies-queries';
import { nativeFieldClass } from '../inspector-panel';

export interface TermPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Which term a PageGrid lists (docs/adr/0064).
 *
 * Grouped by dimension, because a bare list of terms is ambiguous the
 * moment a site has two of them: "Espresso" under Category and under
 * Family are different answers to the same word.
 *
 * The term's name is shown in whatever language it has one — the picker
 * is the agency's tool and the block stores an id, so a term named only
 * in Italian is still pickable while editing the English page.
 */
export function TermPickerField({ value, onChange }: TermPickerFieldProps) {
  const { t } = useTranslation();
  const { data: site } = useQuery(siteQueryOptions());
  const { data: taxonomies } = useQuery({
    ...taxonomiesQueryOptions(site?.id ?? ''),
    enabled: Boolean(site),
  });
  const termQueries = useQueries({
    queries: (taxonomies ?? []).map((taxonomy) =>
      termsQueryOptions(taxonomy.id),
    ),
  });

  return (
    <select
      className={nativeFieldClass}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">{t('blocks.pageGrid.picker.none')}</option>
      {(taxonomies ?? []).map((taxonomy, index) => (
        <optgroup
          key={taxonomy.id}
          label={
            firstNamed(taxonomy.name) || t('blocks.pageGrid.picker.unnamed')
          }
        >
          {(termQueries[index]?.data ?? []).map((term) => (
            <option key={term.id} value={term.id}>
              {firstNamed(term.name) || t('blocks.pageGrid.picker.unnamed')}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** A term exists before it is named everywhere; any language it does have is a better label than its id. */
function firstNamed(name: Record<string, string>): string {
  return Object.values(name).find((value) => value.trim() !== '') ?? '';
}
