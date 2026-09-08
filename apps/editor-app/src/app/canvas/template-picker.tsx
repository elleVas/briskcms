import { useQuery } from '@tanstack/react-query';
import { copySectionBlocks, type Block } from '@brisk/shared-types';
import { useTranslation } from '../../lib/use-translation';
import { reusableSectionsQueryOptions } from '../reusable-sections-queries';

export interface TemplatePickerProps {
  siteId: string;
  onInsert: (blocks: (Block & { id: string })[]) => void;
}

/**
 * The templates, beside the blocks (docs/adr/0059).
 *
 * A template is a COPY taken once: what lands on the page is its blocks,
 * with brand-new ids, and nothing afterwards links them back. That is the
 * whole difference from a shared section, and it is why templates are a
 * second list here rather than a checkbox on the section picker — the
 * person inserting one is choosing between two different promises, and
 * the menu has to say which.
 *
 * The PUBLISHED content, never the draft: what a template hands out is
 * what its author signed off on.
 */
export function TemplatePicker({ siteId, onInsert }: TemplatePickerProps) {
  const { t } = useTranslation();
  const { data: sections } = useQuery(reusableSectionsQueryOptions(siteId));
  const templates = (sections ?? []).filter(
    (section) => section.kind === 'template' && section.publishedContent,
  );

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 border-t pt-3">
      <span className="text-xs font-medium text-muted-foreground">
        {t('sections.templates')}
      </span>
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className="rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted"
          onClick={() =>
            onInsert(
              // New ids on every copy: two copies of one template on one
              // page would otherwise share block ids, and a per-instance
              // style set on one would land on both.
              copySectionBlocks(template.publishedContent ?? [], () =>
                crypto.randomUUID(),
              ) as (Block & { id: string })[],
            )
          }
        >
          {template.name}
        </button>
      ))}
    </div>
  );
}
