import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../lib/use-translation';
import { siteQueryOptions } from '../../site-queries';
import { taxonomiesQueryOptions } from '../../taxonomies-queries';
import { nativeFieldClass } from '../inspector-panel';

export interface TaxonomyPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Which dimension a TermList offers — Category, Family, Tag.
 *
 * A dimension and not a term, which is the whole difference from
 * TermPickerField: a filter is "let the reader choose among these", so
 * what it stores is the question, and the answers are whatever terms
 * exist when somebody reads the page.
 */
export function TaxonomyPickerField({
  value,
  onChange,
}: TaxonomyPickerFieldProps) {
  const { t } = useTranslation();
  const { data: site } = useQuery(siteQueryOptions());
  const { data: taxonomies } = useQuery({
    ...taxonomiesQueryOptions(site?.id ?? ''),
    enabled: Boolean(site),
  });

  return (
    <select
      className={nativeFieldClass}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">{t('blocks.termList.picker.none')}</option>
      {(taxonomies ?? []).map((taxonomy) => (
        <option key={taxonomy.id} value={taxonomy.id}>
          {firstNamed(taxonomy.name) || t('blocks.termList.picker.unnamed')}
        </option>
      ))}
    </select>
  );
}

/** A dimension exists before it is named everywhere; any language it does have beats its id. */
function firstNamed(name: Record<string, string>): string {
  return Object.values(name).find((value) => value.trim() !== '') ?? '';
}
