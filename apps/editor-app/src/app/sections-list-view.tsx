import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslation } from '../lib/use-translation';
import {
  createReusableSection,
  deleteReusableSection,
  type ReusableSectionKind,
} from '../lib/reusable-sections-api-client';
import { reusableSectionsQueryOptions } from './reusable-sections-queries';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { IconButton } from './icon-button';

export interface SectionsListViewProps {
  siteId: string;
}

/**
 * The list, and the only place a section is created. Deliberately its own
 * screen rather than a dialog inside the page editor (docs/adr/0059): a
 * shared section is edited on its own, and the way in has to make that
 * obvious rather than making it feel like part of the page you were on.
 */
export function SectionsListView({ siteId }: SectionsListViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryOptions = reusableSectionsQueryOptions(siteId);
  const { data: sections } = useSuspenseQuery(queryOptions);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ReusableSectionKind>('shared');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createReusableSection({ siteId, name: name.trim(), kind }),
    onSuccess: () => {
      setName('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    },
    onError: (caught: unknown) =>
      // A 409 is the only failure a person can act on here, and the name
      // is the thing they can change.
      setError(
        String(caught).includes('409')
          ? t('sections.nameTaken')
          : String(caught),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReusableSection(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: queryOptions.queryKey }),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('sections.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('sections.subtitle')}
        </p>
      </header>

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t('sections.nameLabel')}
          </span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex min-w-64 flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t('sections.kindLabel')}
          </span>
          <select
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as ReusableSectionKind)}
          >
            <option value="shared">{t('sections.kind.shared')}</option>
            <option value="template">{t('sections.kind.template')}</option>
          </select>
        </label>
        <Button type="submit" disabled={!name.trim()}>
          {t('sections.create')}
        </Button>
        {error && <p className="w-full text-sm text-destructive">{error}</p>}
      </form>

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('sections.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {sections.map((section) => (
            <li
              key={section.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="flex min-w-0 flex-col">
                <Link
                  to="/sections/$sectionId"
                  params={{ sectionId: section.id }}
                  className="truncate font-medium hover:underline"
                >
                  {section.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {t(`sections.kindShort.${section.kind}`)} ·{' '}
                  {t(`sections.status.${section.status}`)}
                </span>
              </div>
              <IconButton
                label={t('sections.delete')}
                onClick={() => {
                  if (window.confirm(t('sections.deleteConfirm'))) {
                    deleteMutation.mutate(section.id);
                  }
                }}
              >
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
