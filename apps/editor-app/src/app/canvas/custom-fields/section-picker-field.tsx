import { useQuery } from '@tanstack/react-query';
import type { PickedSection } from '@brisk/shared-types';
import { useTranslation } from '../../../lib/use-translation';
import { siteQueryOptions } from '../../site-queries';
import { reusableSectionsQueryOptions } from '../../reusable-sections-queries';
import { nativeFieldClass } from '../inspector-panel';

export interface SectionPickerFieldProps {
  value: PickedSection | null;
  onChange: (value: PickedSection | null) => void;
}

/**
 * Which reusable section this instance shows (docs/adr/0059).
 *
 * Only `shared` sections are offered. A template is not a thing a page can
 * point at — inserting one COPIES its blocks and leaves nothing behind to
 * reference — so listing templates here would offer a choice that cannot
 * be honoured.
 */
export function SectionPickerField({
  value,
  onChange,
}: SectionPickerFieldProps) {
  const { t } = useTranslation();
  const { data: site } = useQuery(siteQueryOptions());
  const { data: sections } = useQuery({
    ...reusableSectionsQueryOptions(site?.id ?? ''),
    enabled: Boolean(site),
  });
  const shared = (sections ?? []).filter(
    (section) => section.kind === 'shared',
  );

  return (
    <select
      className={nativeFieldClass}
      value={value?.sectionId ?? ''}
      onChange={(event) => {
        const picked = shared.find(
          (section) => section.id === event.target.value,
        );
        onChange(
          picked ? { sectionId: picked.id, sectionName: picked.name } : null,
        );
      }}
    >
      <option value="">{t('blocks.section.picker.none')}</option>
      {shared.map((section) => (
        <option key={section.id} value={section.id}>
          {section.name}
          {section.status === 'draft'
            ? ` — ${t('blocks.section.picker.unpublished')}`
            : ''}
        </option>
      ))}
    </select>
  );
}
