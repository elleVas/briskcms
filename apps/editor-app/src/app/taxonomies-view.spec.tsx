import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/taxonomies-api-client';
import * as sitesApi from '../lib/sites-api-client';
import type { TaxonomyDto } from '../lib/taxonomies-api-client';
import { createTestQueryClient } from '../test-query-client';
import { TaxonomiesView } from './taxonomies-view';

vi.mock('../lib/taxonomies-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/taxonomies-api-client')>();
  return {
    ...actual,
    listTaxonomies: vi.fn(),
    listTerms: vi.fn(),
    createTaxonomy: vi.fn(),
    updateTaxonomy: vi.fn(),
    deleteTaxonomy: vi.fn(),
  };
});

vi.mock('../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client')>();
  return { ...actual, getCurrentSite: vi.fn() };
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

function renderView(taxonomies: TaxonomyDto[]) {
  vi.mocked(api.listTaxonomies).mockResolvedValue(taxonomies);
  vi.mocked(api.listTerms).mockResolvedValue([]);
  vi.mocked(sitesApi.getCurrentSite).mockResolvedValue({
    id: 'site-1',
    defaultLocale: 'it',
    enabledLocales: ['it', 'en'],
  } as Awaited<ReturnType<typeof sitesApi.getCurrentSite>>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <TaxonomiesView siteId="site-1" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('TaxonomiesView', () => {
  afterEach(() => vi.clearAllMocks());

  /*
   * "No dimension yet." was the whole message, about a concept a client has
   * never met — it said the screen was empty and nothing about what would
   * fill it, or how.
   */
  it('shows an empty state that explains what a dimension is, and leads to the first step', async () => {
    renderView([]);

    expect(
      await screen.findByText(/Una dimensione è un modo di classificare/),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /Dai un nome alla prima dimensione/ }),
    );

    // The button is the first step, not decoration: it puts the cursor
    // where the answer goes.
    expect(document.activeElement).toBe(screen.getAllByLabelText('Nome')[0]);
  });

  /*
   * The three states of a prefix are the whole reason the API takes it
   * as `absent | null | string` (docs/adr/0064), and the form is where
   * they are decided. Absent means "derive one from the name" — sending
   * an empty string instead would ask for an empty URL segment.
   */
  it('leaves the prefix out entirely when none was typed', async () => {
    renderView([]);
    await screen.findByText(/Una dimensione è un modo di classificare/);

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Famiglia' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Aggiungi dimensione' }),
    );

    await waitFor(() =>
      expect(vi.mocked(api.createTaxonomy)).toHaveBeenCalledWith({
        siteId: 'site-1',
        name: { it: 'Famiglia' },
      }),
    );
  });

  it('sends a null prefix when the dimension is mounted at the root', async () => {
    renderView([]);
    await screen.findByText(/Una dimensione è un modo di classificare/);

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Famiglia' },
    });
    fireEvent.click(screen.getByLabelText('Nessun prefisso (radice del sito)'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Aggiungi dimensione' }),
    );

    await waitFor(() =>
      expect(vi.mocked(api.createTaxonomy)).toHaveBeenCalledWith({
        siteId: 'site-1',
        name: { it: 'Famiglia' },
        prefix: null,
      }),
    );
  });

  it('sends the prefix that was typed', async () => {
    renderView([]);
    await screen.findByText(/Una dimensione è un modo di classificare/);

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Famiglia' },
    });
    fireEvent.change(screen.getByLabelText('Prefisso URL'), {
      target: { value: 'fam' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Aggiungi dimensione' }),
    );

    await waitFor(() =>
      expect(vi.mocked(api.createTaxonomy)).toHaveBeenCalledWith({
        siteId: 'site-1',
        name: { it: 'Famiglia' },
        prefix: 'fam',
      }),
    );
  });

  it('shows where a dimension terms answer', async () => {
    renderView([taxonomy, { ...taxonomy, id: 'taxonomy-2', prefix: null }]);

    expect(await screen.findByText('/categoria/…')).toBeTruthy();
    expect(screen.getByText('alla radice del sito')).toBeTruthy();
  });

  it('renames a dimension when the field loses focus, and not before', async () => {
    renderView([taxonomy]);
    const field = (await screen.findAllByLabelText('Nome'))[1];

    fireEvent.change(field, { target: { value: 'Famiglia' } });
    expect(vi.mocked(api.updateTaxonomy)).not.toHaveBeenCalled();

    fireEvent.blur(field);

    await waitFor(() =>
      expect(vi.mocked(api.updateTaxonomy)).toHaveBeenCalledWith('taxonomy-1', {
        name: { it: 'Famiglia' },
      }),
    );
  });

  it('reports a taken address in words a person can act on', async () => {
    renderView([]);
    await screen.findByText(/Una dimensione è un modo di classificare/);
    vi.mocked(api.createTaxonomy).mockRejectedValue(new Error('API 409: {}'));

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Categoria' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Aggiungi dimensione' }),
    );

    expect(
      await screen.findByText(
        "Un'altra dimensione o una pagina risponde già a quell'indirizzo.",
      ),
    ).toBeTruthy();
  });
});
