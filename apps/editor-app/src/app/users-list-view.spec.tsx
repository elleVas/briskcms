import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/users-api-client';
import type { UserDto } from '../lib/users-api-client';
import { createTestQueryClient } from '../test-query-client';
import { UsersListView } from './users-list-view';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/users-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/users-api-client')>();
  return {
    ...actual,
    inviteUser: vi.fn(),
    updateUserRole: vi.fn(),
    setUserActive: vi.fn(),
  };
});

const userOne: UserDto = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'editor@example.com',
  displayName: 'Editor One',
  role: 'editor',
  isActive: true,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '',
};

function renderView(
  items: UserDto[],
  options: { page?: number; total?: number } = {},
) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <UsersListView
          items={items}
          page={options.page ?? 1}
          total={options.total ?? items.length}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('UsersListView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no users', () => {
    renderView([]);

    expect(screen.getByText(/nessun utente ancora/i)).toBeTruthy();
  });

  it('lists users with their name, email, and status', () => {
    renderView([userOne]);

    expect(screen.getByText('Editor One')).toBeTruthy();
    expect(screen.getByText('editor@example.com')).toBeTruthy();
    expect(screen.getByText('Attivo')).toBeTruthy();
  });

  it('changes a user role', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.updateUserRole).mockResolvedValue({
      ...userOne,
      role: 'admin',
    });

    renderView([userOne]);
    fireEvent.change(
      screen.getByRole('combobox', { name: /ruolo di editor one/i }),
      { target: { value: 'admin' } },
    );

    await waitFor(() =>
      expect(api.updateUserRole).toHaveBeenCalledWith('user-1', 'admin'),
    );
  });

  it('deactivates an active user', async () => {
    vi.mocked(api.setUserActive).mockResolvedValue({
      ...userOne,
      isActive: false,
    });

    renderView([userOne]);
    fireEvent.click(screen.getByRole('button', { name: /^disattiva$/i }));

    await waitFor(() =>
      expect(api.setUserActive).toHaveBeenCalledWith('user-1', false),
    );
  });

  it('opens the invite dialog', () => {
    renderView([]);

    fireEvent.click(screen.getByRole('button', { name: /invita utente/i }));

    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows pagination controls when there is more than one page', () => {
    renderView([userOne], { total: 40 });

    expect(screen.getByText('Pagina 1 di 2')).toBeTruthy();
  });
});
