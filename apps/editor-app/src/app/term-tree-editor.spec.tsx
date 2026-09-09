import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/taxonomies-api-client';
import type { TaxonomyDto, TermDto } from '../lib/taxonomies-api-client';
import { createTestQueryClient } from '../test-query-client';
import { MediaPickerProvider } from './media-picker-provider';
import { TermTreeEditor } from './term-tree-editor';

vi.mock('../lib/taxonomies-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/taxonomies-api-client')>();
  return {
    ...actual,
    listTerms: vi.fn(),
    createTerm: vi.fn(),
    updateTerm: vi.fn(),
    moveTerm: vi.fn(),
    deleteTerm: vi.fn(),
  };
});

const taxonomy: TaxonomyDto = {
  id: 'taxonomy-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  prefix: 'categoria',
  name: { it: 'Categoria' },
  hierarchical: true,
  order: 0,
  createdAt: '',
  updatedAt: '',
};

function term(overrides: Partial<TermDto> & { id: string }): TermDto {
  return {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    taxonomyId: 'taxonomy-1',
    parentId: null,
    name: { it: overrides.id },
    description: {},
    seoMeta: {},
    landingPageGroupId: null,
    order: 0,
    slugs: { it: overrides.id },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function renderEditor(terms: TermDto[]) {
  vi.mocked(api.listTerms).mockResolvedValue(terms);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        {/* The SEO dialog offers an OG image, so this screen mounts the
            media picker — see TaxonomiesView. */}
        <MediaPickerProvider siteId="site-1">
          <TermTreeEditor
            siteId="site-1"
            taxonomy={taxonomy}
            locales={['it', 'en']}
            defaultLocale="it"
          />
        </MediaPickerProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('TermTreeEditor', () => {
  afterEach(() => vi.clearAllMocks());

  /*
   * Everything below was reachable only through the API until now
   * (docs/adr/0067's SEO, docs/adr/0064's landing page): the screen let
   * you name a term and give it an address, and then asked you to open a
   * terminal for the rest.
   */
  it('saves a term description per language', async () => {
    vi.mocked(api.updateTerm).mockResolvedValue(term({ id: 'macchine' }));
    renderEditor([term({ id: 'macchine', name: { it: 'Macchine' } })]);

    fireEvent.click(await screen.findByRole('button', { name: /Macchine/ }));
    const descriptions = screen.getAllByPlaceholderText(
      /Compare sopra|Shown above/,
    );
    fireEvent.blur(descriptions[0]!, {
      target: { value: 'Le macchine da caffè' },
    });

    await waitFor(() =>
      expect(api.updateTerm).toHaveBeenCalledWith('macchine', {
        description: { it: 'Le macchine da caffè' },
      }),
    );
  });

  it('saves the SEO of one language without touching the others', async () => {
    vi.mocked(api.updateTerm).mockResolvedValue(term({ id: 'macchine' }));
    renderEditor([
      term({
        id: 'macchine',
        name: { it: 'Macchine' },
        seoMeta: { en: { title: 'Machines', description: 'kept' } },
      }),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: /Macchine/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'SEO' })[0]!);

    const title = await screen.findByLabelText(/Titolo|Title/);
    fireEvent.change(title, { target: { value: 'Macchine da caffè' } });
    fireEvent.click(screen.getByRole('button', { name: /Salva|Save/ }));

    await waitFor(() =>
      expect(api.updateTerm).toHaveBeenCalledWith('macchine', {
        seoMeta: {
          en: { title: 'Machines', description: 'kept' },
          it: { title: 'Macchine da caffè', description: '' },
        },
      }),
    );
  });

  /*
   * The term's URL answers either way — with no page it serves the
   * default layout — so detaching one has to be as reachable as choosing
   * it, and must send null rather than omitting the field.
   */
  it('lets a term go back to the default layout', async () => {
    vi.mocked(api.updateTerm).mockResolvedValue(term({ id: 'macchine' }));
    renderEditor([
      term({
        id: 'macchine',
        name: { it: 'Macchine' },
        landingPageGroupId: 'page-9',
      }),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: /Macchine/ }));
    fireEvent.click(
      screen.getByRole('button', {
        name: /disposizione predefinita|default layout/i,
      }),
    );

    await waitFor(() =>
      expect(api.updateTerm).toHaveBeenCalledWith('macchine', {
        landingPageGroupId: null,
      }),
    );
  });

  /*
   * The slug is next to the name and not behind an "advanced" toggle: it
   * IS the address, and hiding it is how somebody publishes fifty terms
   * and only then notices what their URLs say (docs/adr/0064).
   */
  it('shows each term address as it will answer', async () => {
    renderEditor([
      term({
        id: 'macchine',
        name: { it: 'Macchine' },
        slugs: { it: 'macchine' },
      }),
    ]);

    // One span, two expressions: the address reads as one string.
    const row = await screen.findByRole('button', { name: /Macchine/ });
    expect(row.textContent).toContain('/categoria/macchine');
  });

  it('reads the tree in order, children under their parent', async () => {
    renderEditor([
      term({ id: 'b', name: { it: 'B' } }),
      term({ id: 'b-child', name: { it: 'B child' }, parentId: 'b' }),
      term({ id: 'a', name: { it: 'A' } }),
    ]);

    const rows = await screen.findAllByRole('button', {
      name: /\/categoria\//,
    });
    // The address is part of the same button, so the whole label is what
    // identifies a row: parent, its child, then the next root.
    expect(rows.map((row) => row.textContent?.trim())).toEqual([
      'B/categoria/b',
      'B child/categoria/b-child',
      'A/categoria/a',
    ]);
  });

  /*
   * An emptied slug is not an empty address: it means the term is not
   * published in that language at all, which the API models as the key
   * being absent from the map.
   */
  it('drops a language from the map when its slug is cleared', async () => {
    renderEditor([
      term({ id: 'x', name: { it: 'X' }, slugs: { it: 'x', en: 'x-en' } }),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: /^X\// }));

    const slugFields = screen.getAllByLabelText('Slug');
    fireEvent.blur(slugFields[1], { target: { value: '  ' } });

    await waitFor(() =>
      expect(vi.mocked(api.updateTerm)).toHaveBeenCalledWith('x', {
        name: undefined,
        slugs: { it: 'x' },
      }),
    );
  });

  /*
   * The API refuses a term as its own descendant, and offering the
   * choice would be offering an error — so the branch below the term is
   * not in the list at all.
   */
  it('never offers a term its own branch as a parent', async () => {
    renderEditor([
      term({ id: 'parent', name: { it: 'Parent' } }),
      term({ id: 'child', name: { it: 'Child' }, parentId: 'parent' }),
      term({ id: 'grandchild', name: { it: 'Grandchild' }, parentId: 'child' }),
      term({ id: 'other', name: { it: 'Other' } }),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: /Parent/ }));

    const options = [
      ...screen.getByLabelText('Dentro').querySelectorAll('option'),
    ].map((option) => option.textContent);
    expect(options).toEqual(['Primo livello', 'Other']);
  });

  it('creates a term under the parent that was chosen', async () => {
    renderEditor([term({ id: 'parent', name: { it: 'Parent' } })]);
    await screen.findByRole('button', { name: /Parent/ });

    fireEvent.change(screen.getByLabelText('Nuovo termine'), {
      target: { value: 'Espresso' },
    });
    fireEvent.change(screen.getByLabelText('Dentro (per il nuovo termine)'), {
      target: { value: 'parent' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi termine' }));

    await waitFor(() =>
      expect(vi.mocked(api.createTerm)).toHaveBeenCalledWith('taxonomy-1', {
        name: { it: 'Espresso' },
        parentId: 'parent',
      }),
    );
  });
});
