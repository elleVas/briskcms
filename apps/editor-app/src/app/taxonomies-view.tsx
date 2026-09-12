import { useRef, useState } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import type { LocalizedText } from '@brisk/shared-types';
import { useTranslation } from '../lib/use-translation';
import {
  createTaxonomy,
  deleteTaxonomy,
  updateTaxonomy,
} from '../lib/taxonomies-api-client';
import { taxonomiesQueryOptions } from './taxonomies-queries';
import { siteQueryOptions } from './site-queries';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { IconButton } from './icon-button';
import { MediaPickerProvider } from './media-picker-provider';
import { TermTreeEditor } from './term-tree-editor';

export interface TaxonomiesViewProps {
  siteId: string;
}

/** A term is named in every language the site publishes; the first one that has a name is what a list shows. */
export function firstNamed(name: LocalizedText): string {
  return Object.values(name).find((value) => value.trim() !== '') ?? '';
}

/**
 * The dimensions a site classifies along, and the terms inside them
 * (docs/adr/0064).
 *
 * Its own screen and not a tab of the page editor: a dimension outlives
 * any one page, and half the point of the model is that the same terms
 * will later classify things that are not pages at all.
 */
export function TaxonomiesView({ siteId }: TaxonomiesViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const options = taxonomiesQueryOptions(siteId);
  const { data: taxonomies } = useSuspenseQuery(options);
  const { data: site } = useSuspenseQuery(siteQueryOptions());
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [rootMounted, setRootMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: options.queryKey });

  const createMutation = useMutation({
    mutationFn: () =>
      createTaxonomy({
        siteId,
        name: { [site.defaultLocale]: name.trim() },
        // Three states on purpose (ADR-0064): a prefix, deliberately
        // none, or "derive one from the name" — which is the key being
        // absent, not an empty string.
        ...(rootMounted
          ? { prefix: null }
          : prefix.trim()
            ? { prefix: prefix.trim() }
            : {}),
      }),
    onSuccess: () => {
      setName('');
      setPrefix('');
      setRootMounted(false);
      setError(null);
      invalidate();
    },
    onError: (caught: unknown) =>
      setError(
        String(caught).includes('409')
          ? t('taxonomies.prefixTaken')
          : String(caught),
      ),
  });

  const renameMutation = useMutation({
    mutationFn: (input: { id: string; name: LocalizedText }) =>
      updateTaxonomy(input.id, { name: input.name }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTaxonomy(id),
    onSuccess: invalidate,
  });

  return (
    // A term's SEO offers an OG image, and choosing one is the media
    // picker — the same reason page-groups-list-view and the section
    // editors mount it. Without it the SEO button on this screen throws
    // the moment it renders, which a test caught before anybody clicked
    // it.
    <MediaPickerProvider siteId={siteId}>
      <div className="flex flex-col gap-6 p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t('taxonomies.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('taxonomies.subtitle')}
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
              {t('taxonomies.nameLabel')}
            </span>
            <Input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t('taxonomies.prefixLabel')}
            </span>
            <Input
              value={prefix}
              disabled={rootMounted}
              placeholder={t('taxonomies.prefixPlaceholder')}
              onChange={(e) => setPrefix(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={rootMounted}
              onChange={(e) => setRootMounted(e.target.checked)}
            />
            {t('taxonomies.rootMounted')}
          </label>
          <Button type="submit" disabled={!name.trim()}>
            {t('taxonomies.create')}
          </Button>
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
          <p className="w-full text-xs text-muted-foreground">
            {t('taxonomies.prefixHint')}
          </p>
        </form>

        {taxonomies.length === 0 ? (
          // "No dimension yet." over a concept nobody is born knowing. It
          // says what a dimension IS, with an example, and takes you to the
          // field that makes one.
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
            <p className="text-sm text-muted-foreground">
              {t('taxonomies.emptyExplainer')}
            </p>
            <Button
              variant="outline"
              onClick={() => nameInputRef.current?.focus()}
            >
              {t('taxonomies.emptyAction')}
            </Button>
          </div>
        ) : (
          taxonomies.map((taxonomy) => (
            <section
              key={taxonomy.id}
              className="flex flex-col gap-3 rounded-lg border p-4"
            >
              <header className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Input
                    className="max-w-64"
                    defaultValue={firstNamed(taxonomy.name)}
                    aria-label={t('taxonomies.nameLabel')}
                    onBlur={(event) => {
                      const next = event.target.value.trim();
                      if (next && next !== firstNamed(taxonomy.name)) {
                        renameMutation.mutate({
                          id: taxonomy.id,
                          name: {
                            ...taxonomy.name,
                            [site.defaultLocale]: next,
                          },
                        });
                      }
                    }}
                  />
                  <code className="text-xs text-muted-foreground">
                    {taxonomy.prefix
                      ? `/${taxonomy.prefix}/…`
                      : t('taxonomies.atRoot')}
                  </code>
                </div>
                <IconButton
                  label={t('taxonomies.delete')}
                  onClick={() => {
                    // Deleting a dimension takes its terms with it, and
                    // every page stops being filed under them — the pages
                    // themselves are untouched (ADR-0064).
                    if (window.confirm(t('taxonomies.deleteConfirm'))) {
                      deleteMutation.mutate(taxonomy.id);
                    }
                  }}
                >
                  <Trash2 />
                </IconButton>
              </header>
              <TermTreeEditor
                siteId={siteId}
                taxonomy={taxonomy}
                locales={site.enabledLocales}
                defaultLocale={site.defaultLocale}
              />
            </section>
          ))
        )}
      </div>
    </MediaPickerProvider>
  );
}
