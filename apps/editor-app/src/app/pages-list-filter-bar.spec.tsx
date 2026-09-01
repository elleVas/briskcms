import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as usersApi from '../lib/users-api-client';
import { createTestQueryClient } from '../test-query-client';
import {
  EMPTY_PAGES_LIST_FILTERS,
  PagesListFilterBar,
  type PagesListFilterValues,
} from './pages-list-filter-bar';

vi.mock('../lib/users-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/users-api-client')>();
  return { ...actual, listUsers: vi.fn() };
});

function renderBar(
  value: PagesListFilterValues = EMPTY_PAGES_LIST_FILTERS,
  onChange = vi.fn(),
) {
  vi.mocked(usersApi.listUsers).mockResolvedValue({
    items: [
      {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'ada@example.test',
        displayName: 'Ada Lovelace',
        role: 'admin',
        isActive: true,
        emailVerifiedAt: null,
        createdAt: '',
      },
    ],
    total: 1,
  });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createTestQueryClient()}>
        {children}
      </QueryClientProvider>
    );
  }
  return {
    onChange,
    ...render(
      <PagesListFilterBar
        value={value}
        onChange={onChange}
        enabledLocales={['it', 'en']}
      />,
      { wrapper },
    ),
  };
}

describe('PagesListFilterBar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls onChange with the updated search text, keeping other filters unchanged', () => {
    const { onChange } = renderBar({
      ...EMPTY_PAGES_LIST_FILTERS,
      locale: 'it',
    });

    fireEvent.change(screen.getByLabelText('Titolo'), {
      target: { value: 'chi siamo' },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_PAGES_LIST_FILTERS,
      locale: 'it',
      search: 'chi siamo',
    });
  });

  it('calls onChange with the updated date range', () => {
    const { onChange } = renderBar();

    fireEvent.change(screen.getByLabelText('Da'), {
      target: { value: '2026-01-01' },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_PAGES_LIST_FILTERS,
      createdAfter: '2026-01-01',
    });
  });

  it('does not show the clear button when no filter is active', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: 'Rimuovi filtri' })).toBeNull();
  });

  it('shows the clear button once a filter is active, and resets everything on click', () => {
    const { onChange } = renderBar({
      ...EMPTY_PAGES_LIST_FILTERS,
      search: 'chi siamo',
    });

    const clearButton = screen.getByRole('button', { name: 'Rimuovi filtri' });
    fireEvent.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(EMPTY_PAGES_LIST_FILTERS);
  });
});
