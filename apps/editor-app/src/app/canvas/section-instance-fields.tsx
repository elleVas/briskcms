import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  sectionOverrideKey,
  type Block,
  type PickedSection,
} from '@brisk/shared-types';
import { useTranslation } from '../../lib/use-translation';
import { reusableSectionQueryOptions } from '../reusable-sections-queries';
import { nativeFieldClass } from './inspector-panel';

export interface SectionInstanceFieldsProps {
  section: PickedSection | null;
  props: Record<string, unknown>;
  onChangeProp: (key: string, value: unknown) => void;
}

/** A readable name for one block inside a section — its own text where it has any. */
function blockLabel(block: Block): string {
  for (const key of ['title', 'label', 'heading', 'text', 'message']) {
    const value = block.props?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim().slice(0, 40);
    }
  }
  return block.type;
}

function flatten(blocks: Block[]): Block[] {
  return blocks.flatMap((block) => [
    block,
    ...(block.children ? flatten(block.children) : []),
  ]);
}

/**
 * The inputs an instance actually gets: one per field the section's author
 * marked editable, and nothing else (docs/adr/0059).
 *
 * Not declared in the block descriptor, because it cannot be. Which fields
 * exist here depends on the SECTION this instance points at — data fetched
 * at runtime — while a descriptor is static and has to survive being
 * serialised as JSON for a theme. So the Inspector special-cases this one
 * type, and the special case is small and visible rather than a general
 * mechanism nothing else would use.
 *
 * The published content, not the draft: an instance can only override what
 * is actually live on the page.
 */
export function SectionInstanceFields({
  section,
  props,
  onChangeProp,
}: SectionInstanceFieldsProps) {
  const { t } = useTranslation();
  const { data: full } = useQuery({
    ...reusableSectionQueryOptions(section?.sectionId ?? ''),
    enabled: Boolean(section),
  });

  if (!section) {
    return null;
  }
  if (!full) {
    return (
      <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
    );
  }

  const blocks = flatten(full.publishedContent ?? full.content);
  const rows = blocks.flatMap((block) => {
    const fields = block.id ? (full.exposedFields[block.id] ?? []) : [];
    return fields.map((field) => ({ block, field }));
  });

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('blocks.section.instance.title')}
        </span>
        {/* The only way in: a shared section is edited in its own editor,
            never from a page (docs/adr/0059). */}
        <Link
          to="/sections/$sectionId"
          params={{ sectionId: section.sectionId }}
          className="text-xs hover:underline"
        >
          {t('blocks.section.instance.edit')}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('blocks.section.instance.noExposedFields')}
        </p>
      ) : (
        rows.map(({ block, field }) => {
          const key = sectionOverrideKey(block.id ?? '', field);
          const value = props[key];
          return (
            <label key={key} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {blockLabel(block)} · {field}
              </span>
              <input
                className={nativeFieldClass}
                value={typeof value === 'string' ? value : ''}
                placeholder={
                  typeof block.props?.[field] === 'string'
                    ? (block.props[field] as string)
                    : ''
                }
                onChange={(event) =>
                  // Empty means "use the section's own value", so the
                  // override is removed rather than stored as an empty
                  // string — otherwise clearing the box would blank the
                  // text on this page instead of restoring the default.
                  onChangeProp(key, event.target.value || undefined)
                }
              />
            </label>
          );
        })
      )}
    </div>
  );
}
