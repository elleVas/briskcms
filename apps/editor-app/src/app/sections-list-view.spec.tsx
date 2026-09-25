import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../components/ui/tooltip';
import type { ReusableSectionListItem } from '../lib/reusable-sections-api-client';
import * as sectionsApi from '../lib/reusable-sections-api-client';
import { createTestQueryClient } from '../test/query-client.test-fixture';
import { buildReusableSectionListItem } from '@brisk/testing/records';
import { reusableSectionsQueryOptions } from './reusable-sections-queries';
import { SectionsListView } from './sections-list-view';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (await import('../test/router-link.test-fixture')).StubLink,
  };
});

vi.mock('../lib/reusable-sections-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../lib/reusable-sections-api-client')
    >();
  return { ...actual, deleteReusableSection: vi.fn() };
});

function section(
  overrides: Partial<ReusableSectionListItem>,
): ReusableSectionListItem {
  return buildReusableSectionListItem({
    name: 'Newsletter',
    status: 'published',
    publishedContent: [],
    ...overrides,
  });
}

function renderList(sections: ReusableSectionListItem[]) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    reusableSectionsQueryOptions('site-1').queryKey,
    sections,
  );
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SectionsListView siteId="site-1" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('SectionsListView — where a shared section is used', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /*
   * The newsletter inside a template (docs/adr/0072): it stands on the
   * pages made so far AND in the template that makes the next ones, and
   * the list is where somebody looks before deleting it.
   */
  it('counts the templates that hold it beside the pages that show it', () => {
    renderList([
      section({
        id: 'a',
        name: 'Newsletter',
        usedOnPages: 2,
        usedInTemplates: 1,
      }),
      section({ id: 'b', name: 'Banner', usedInTemplates: 3 }),
      section({ id: 'c', name: 'Unused' }),
    ]);

    expect(
      screen.getByText('Condivisa · Pubblicata · su 2 pagine · in 1 template'),
    ).toBeTruthy();
    expect(
      screen.getByText('Condivisa · Pubblicata · in 3 template'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Condivisa · Pubblicata · non ancora inserita da nessuna parte',
      ),
    ).toBeTruthy();
  });

  it('warns, before deleting, about the pages still to be made from a template', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderList([
      section({ name: 'Newsletter', usedOnPages: 2, usedInTemplates: 1 }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }));

    expect(confirm).toHaveBeenCalledWith(
      'Eliminare “Newsletter”? È su 2 pagine, e ognuna non mostrerà più niente al suo posto. Sta anche dentro un template: le pagine create da lì in poi avranno una striscia vuota al suo posto.',
    );
    expect(sectionsApi.deleteReusableSection).not.toHaveBeenCalled();
  });
});
