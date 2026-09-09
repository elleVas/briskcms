import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslation } from '../lib/use-translation';
import {
  createTerm,
  deleteTerm,
  moveTerm,
  updateTerm,
  type TaxonomyDto,
  type TermDto,
  type UpdateTermInput,
} from '../lib/taxonomies-api-client';
import { termsQueryOptions } from './taxonomies-queries';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { IconButton } from './icon-button';
import { SeoMetaDialog } from './seo-meta-dialog';
import { TermLandingPageField } from './term-landing-page-field';
import { firstNamed } from './taxonomies-view';

export interface TermTreeEditorProps {
  siteId: string;
  taxonomy: TaxonomyDto;
  locales: string[];
  defaultLocale: string;
}

/** Root first, then each term's children under it — the order the tree reads in. */
function inTreeOrder(
  terms: TermDto[],
  parentId: string | null = null,
  depth = 0,
): { term: TermDto; depth: number }[] {
  return terms
    .filter((term) => term.parentId === parentId)
    .flatMap((term) => [
      { term, depth },
      ...inTreeOrder(terms, term.id, depth + 1),
    ]);
}

/**
 * One dimension's terms (docs/adr/0064): the tree, and what a term is
 * called and answers to in each language.
 *
 * The slug is shown next to the name rather than hidden behind an
 * "advanced" toggle, because it IS the address — a term's URL is the
 * reason the whole feature exists, and hiding it is how somebody
 * publishes fifty terms and only then notices they are all named
 * `categoria-2`.
 */
export function TermTreeEditor({
  siteId,
  taxonomy,
  locales,
  defaultLocale,
}: TermTreeEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const options = termsQueryOptions(taxonomy.id);
  const { data: terms = [] } = useQuery(options);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [openTermId, setOpenTermId] = useState<string | null>(null);
  // Which (term, locale) has its SEO dialog open — one dialog's worth of
  // state for the whole tree, not one per row.
  const [seoFor, setSeoFor] = useState<{
    term: TermDto;
    locale: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: options.queryKey });

  const onConflict = (caught: unknown) =>
    setError(
      String(caught).includes('409')
        ? t('taxonomies.addressTaken')
        : String(caught),
    );

  const createMutation = useMutation({
    mutationFn: () =>
      createTerm(taxonomy.id, {
        name: { [defaultLocale]: name.trim() },
        parentId: parentId || null,
      }),
    onSuccess: () => {
      setName('');
      setParentId('');
      setError(null);
      invalidate();
    },
    onError: onConflict,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...changes }: { id: string } & UpdateTermInput) =>
      updateTerm(id, changes),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: onConflict,
  });

  const moveMutation = useMutation({
    mutationFn: (input: { id: string; parentId: string | null }) =>
      moveTerm(input.id, input.parentId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: onConflict,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTerm(id),
    onSuccess: invalidate,
  });

  const ordered = inTreeOrder(terms);

  return (
    <div className="flex flex-col gap-3">
      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('taxonomies.noTerms')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {ordered.map(({ term, depth }) => (
            <li key={term.id} className="flex flex-col">
              <div
                className="flex items-center justify-between gap-3 p-2"
                style={{ paddingLeft: 8 + depth * 20 }}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                  onClick={() =>
                    setOpenTermId(openTermId === term.id ? null : term.id)
                  }
                >
                  {firstNamed(term.name) || t('taxonomies.unnamed')}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {taxonomy.prefix ? `/${taxonomy.prefix}/` : '/'}
                    {term.slugs[defaultLocale] ?? '—'}
                  </span>
                </button>
                <IconButton
                  label={t('taxonomies.deleteTerm')}
                  onClick={() => {
                    // Its children are promoted, not deleted with it —
                    // the database says so (ON DELETE SET NULL), and the
                    // question has to say the same thing.
                    if (window.confirm(t('taxonomies.deleteTermConfirm'))) {
                      deleteMutation.mutate(term.id);
                    }
                  }}
                >
                  <Trash2 />
                </IconButton>
              </div>

              {openTermId === term.id && (
                <div className="flex flex-col gap-3 border-t bg-muted/30 p-3">
                  {locales.map((locale) => (
                    <div
                      key={locale}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <span className="w-8 pb-2 text-xs font-medium uppercase text-muted-foreground">
                        {locale}
                      </span>
                      <label className="flex min-w-40 flex-1 flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {t('taxonomies.termName')}
                        </span>
                        <Input
                          defaultValue={term.name[locale] ?? ''}
                          onBlur={(event) =>
                            updateMutation.mutate({
                              id: term.id,
                              name: {
                                ...term.name,
                                [locale]: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="flex min-w-40 flex-1 flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {t('taxonomies.termSlug')}
                        </span>
                        <Input
                          defaultValue={term.slugs[locale] ?? ''}
                          placeholder={t('taxonomies.termSlugEmpty')}
                          onBlur={(event) => {
                            const next = { ...term.slugs };
                            // An emptied slug is not an empty address:
                            // it is the term not being published in that
                            // language at all, which is a legitimate
                            // state the API models as an absent key.
                            if (event.target.value.trim() === '') {
                              delete next[locale];
                            } else {
                              next[locale] = event.target.value.trim();
                            }
                            updateMutation.mutate({ id: term.id, slugs: next });
                          }}
                        />
                      </label>
                      <label className="flex min-w-40 flex-1 flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {t('taxonomies.termDescription')}
                        </span>
                        <Textarea
                          rows={2}
                          defaultValue={term.description[locale] ?? ''}
                          placeholder={t('taxonomies.termDescriptionHint')}
                          onBlur={(event) =>
                            updateMutation.mutate({
                              id: term.id,
                              description: {
                                ...term.description,
                                [locale]: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSeoFor({ term, locale })}
                      >
                        {t('taxonomies.termSeo')}
                      </Button>
                    </div>
                  ))}
                  <TermLandingPageField
                    siteId={siteId}
                    locale={defaultLocale}
                    landingPageGroupId={term.landingPageGroupId}
                    onChange={(landingPageGroupId) =>
                      updateMutation.mutate({
                        id: term.id,
                        landingPageGroupId,
                      })
                    }
                  />
                  {taxonomy.hierarchical && (
                    <label className="flex max-w-sm flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {t('taxonomies.parent')}
                      </span>
                      <select
                        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        value={term.parentId ?? ''}
                        onChange={(event) =>
                          moveMutation.mutate({
                            id: term.id,
                            parentId: event.target.value || null,
                          })
                        }
                      >
                        <option value="">{t('taxonomies.noParent')}</option>
                        {terms
                          // Itself is not a parent, and neither is
                          // anything under it — the API refuses both,
                          // and offering them would be offering an error.
                          .filter(
                            (candidate) =>
                              candidate.id !== term.id &&
                              !isDescendantOf(terms, candidate, term.id),
                          )
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {firstNamed(candidate.name) ||
                                t('taxonomies.unnamed')}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
      >
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t('taxonomies.newTerm')}
          </span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {taxonomy.hierarchical && ordered.length > 0 && (
          <select
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            aria-label={t('taxonomies.newTermParent')}
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">{t('taxonomies.noParent')}</option>
            {terms.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {firstNamed(candidate.name) || t('taxonomies.unnamed')}
              </option>
            ))}
          </select>
        )}
        <Button type="submit" variant="outline" disabled={!name.trim()}>
          {t('taxonomies.addTerm')}
        </Button>
        {error && <p className="w-full text-sm text-destructive">{error}</p>}
      </form>
      {seoFor && (
        <SeoMetaDialog
          heading={t('taxonomies.termSeoTitle', {
            term: firstNamed(seoFor.term.name) || t('taxonomies.unnamed'),
            locale: seoFor.locale.toUpperCase(),
          })}
          seoMeta={
            seoFor.term.seoMeta[seoFor.locale] ?? { title: '', description: '' }
          }
          open
          onOpenChange={(open) => {
            if (!open) setSeoFor(null);
          }}
          isSaving={updateMutation.isPending}
          onSave={async (next) => {
            await updateMutation.mutateAsync({
              id: seoFor.term.id,
              seoMeta: { ...seoFor.term.seoMeta, [seoFor.locale]: next },
            });
          }}
        />
      )}
    </div>
  );
}

/** Whether `candidate` sits anywhere under `ancestorId` — the branch a term cannot be moved into. */
function isDescendantOf(
  terms: TermDto[],
  candidate: TermDto,
  ancestorId: string,
): boolean {
  let current: TermDto | undefined = candidate;
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    if (current.parentId === ancestorId) return true;
    seen.add(current.id);
    current = terms.find((term) => term.id === current?.parentId);
  }
  return false;
}
