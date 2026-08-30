import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { usePageList } from '@brisk/block-registry';
import type { PickedPage } from '@brisk/shared-types';
import * as api from '../lib/pages-api-client';
import type { PageListItem } from '../lib/pages-api-client';
import { createTestQueryClient } from '../test-query-client';
import { PageListProvider } from './page-list-provider';

vi.mock('../lib/pages-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client')>();
  return { ...actual, listPages: vi.fn() };
});

const italianPage: PageListItem = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'chi-siamo',
  status: 'published',
  seoMeta: { title: 'Chi siamo', description: '' },
  createdAt: '',
  updatedAt: '',
  hasUnpublishedChanges: false,
};

const englishPage: PageListItem = {
  ...italianPage,
  id: 'page-2',
  locale: 'en',
  slug: 'about-us',
  seoMeta: { title: 'About us', description: '' },
};

function PickerConsumer() {
  const { pick } = usePageList();
  const [result, setResult] = useState<PickedPage | null | 'pending'>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setResult('pending');
          void pick().then(setResult);
        }}
      >
        Apri picker
      </button>
      <p>{result === 'pending' || result === null ? '' : result.title}</p>
    </div>
  );
}

function renderProvider(locale = 'it') {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <PageListProvider siteId="site-1" locale={locale}>
        <PickerConsumer />
      </PageListProvider>
    </QueryClientProvider>,
  );
}

describe('PageListProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the dialog on pick(), offering only pages in the given locale', async () => {
    vi.mocked(api.listPages).mockResolvedValue({
      items: [italianPage, englishPage],
      total: 2,
    });

    renderProvider('it');
    fireEvent.click(screen.getByRole('button', { name: 'Apri picker' }));

    await screen.findByRole('button', { name: /chi siamo/i });
    expect(screen.queryByRole('button', { name: /about us/i })).toBeNull();
  });

  it('resolves with the picked page and closes the dialog', async () => {
    vi.mocked(api.listPages).mockResolvedValue({
      items: [italianPage],
      total: 1,
    });

    renderProvider('it');
    fireEvent.click(screen.getByRole('button', { name: 'Apri picker' }));
    fireEvent.click(await screen.findByRole('button', { name: /chi siamo/i }));

    await waitFor(() => expect(screen.getByText('Chi siamo')).toBeTruthy());
    expect(screen.queryByRole('heading', { name: /scegli/i })).toBeNull();
  });

  it('resolves with null when the dialog is dismissed without a selection', async () => {
    vi.mocked(api.listPages).mockResolvedValue({ items: [], total: 0 });

    renderProvider('it');
    fireEvent.click(screen.getByRole('button', { name: 'Apri picker' }));
    await screen.findByRole('heading', { name: /scegli/i });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
      code: 'Escape',
    });

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /scegli/i })).toBeNull(),
    );
  });
});
