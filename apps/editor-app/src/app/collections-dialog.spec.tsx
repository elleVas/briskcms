import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCollectionRecord } from '@brisk/testing/records';
import { TooltipProvider } from '../components/ui/tooltip';
import * as collectionsApi from '../lib/collections-api-client';
import * as sectionsApi from '../lib/reusable-sections-api-client';
import { createTestQueryClient } from '../test/query-client.test-fixture';
import { buildReusableSectionListItemDto } from '../test/dtos.test-fixture';
import { CollectionsDialog } from './collections-dialog';

vi.mock('../lib/reusable-sections-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../lib/reusable-sections-api-client')
    >();
  return { ...actual, listReusableSections: vi.fn() };
});

vi.mock('../lib/collections-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/collections-api-client')>();
  return { ...actual, listCollections: vi.fn(), updateCollection: vi.fn() };
});

const news = buildCollectionRecord({
  id: 'news',
  defaultTemplateId: 'article',
});

function template(
  id: string,
  name: string,
): sectionsApi.ReusableSectionListItemDto {
  return buildReusableSectionListItemDto({
    id,
    name,
    kind: 'template',
    status: 'published',
    publishedContent: [],
  });
}

function renderDialog(
  sections: sectionsApi.ReusableSectionListItemDto[] = [
    template('article', 'Articolo blog'),
    template('event', 'Evento'),
  ],
) {
  vi.mocked(collectionsApi.listCollections).mockResolvedValue([news]);
  vi.mocked(sectionsApi.listReusableSections).mockResolvedValue(sections);
  vi.mocked(collectionsApi.updateCollection).mockResolvedValue(news);
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <CollectionsDialog siteId="site-1" open onOpenChange={vi.fn()} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('CollectionsDialog — default template', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows what new pages of each collection start from, and changes it', async () => {
    renderDialog();

    const select = await screen.findByRole('combobox', {
      name: 'Nuove pagine da',
    });
    expect(select.textContent).toBe('Articolo blog');

    fireEvent.click(select);
    fireEvent.click(screen.getByRole('option', { name: 'Evento' }));

    await waitFor(() =>
      expect(collectionsApi.updateCollection).toHaveBeenCalledWith('news', {
        defaultTemplateId: 'event',
      }),
    );
  });

  it('clears it with a blank page', async () => {
    renderDialog();

    fireEvent.click(
      await screen.findByRole('combobox', { name: 'Nuove pagine da' }),
    );
    fireEvent.click(screen.getByRole('option', { name: 'Pagina vuota' }));

    await waitFor(() =>
      expect(collectionsApi.updateCollection).toHaveBeenCalledWith('news', {
        defaultTemplateId: null,
      }),
    );
  });

  /*
   * The database clears a default when its template is deleted, but a
   * cached collection can still carry the old id for a while. It must read
   * as a blank page, not as an empty box.
   */
  it('shows a default that is no longer a template as a blank page', async () => {
    renderDialog([template('event', 'Evento')]);

    const select = await screen.findByRole('combobox', {
      name: 'Nuove pagine da',
    });
    expect(select.textContent).toBe('Pagina vuota');
  });

  it('asks nothing about templates on a site that has none', async () => {
    renderDialog([]);

    await screen.findByDisplayValue('News');
    await waitFor(() =>
      expect(sectionsApi.listReusableSections).toHaveBeenCalled(),
    );
    expect(screen.queryByText('Nuove pagine da')).toBeNull();
  });
});
