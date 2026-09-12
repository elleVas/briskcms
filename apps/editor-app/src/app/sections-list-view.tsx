import { useRef, useState } from 'react';
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
  const nameInputRef = useRef<HTMLInputElement>(null);
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
          <Input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
        // "No section yet." was the whole message, about a concept a
        // client has never met. It says what one IS now, and takes you to
        // the field that makes one.
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          <p className="text-sm text-muted-foreground">
            {t('sections.emptyExplainer')}
          </p>
          <Button
            variant="outline"
            onClick={() => nameInputRef.current?.focus()}
          >
            {t('sections.emptyAction')}
          </Button>
        </div>
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
                  {/* Only for a shared section: inserting a template
                      copies its blocks and leaves nothing pointing back,
                      so there is nothing to count and a "0" there would
                      suggest a link that does not exist. */}
                  {section.kind === 'shared' &&
                    ' · ' +
                      (section.usedOnPages === 0
                        ? t('sections.usedNowhere')
                        : t('sections.usedOnPages', {
                            count: section.usedOnPages,
                          }))}
                </span>
              </div>
              <IconButton
                label={t('sections.delete')}
                onClick={() => {
                  // The count is in the question when there is one:
                  // "delete this?" and "delete this, which eight pages
                  // are showing?" are different decisions.
                  const question =
                    section.usedOnPages > 0
                      ? t('sections.deleteConfirmUsed', {
                          name: section.name,
                          count: section.usedOnPages,
                        })
                      : t('sections.deleteConfirm');
                  if (window.confirm(question)) {
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
