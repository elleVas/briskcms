import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip.js';
import * as authApi from '../lib/auth-api-client.js';
import * as api from '../lib/pages-api-client.js';
import { ApiError } from '../lib/http-client.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { routeTree } from '../routeTree.gen.js';
import { createTestQueryClient } from '../test-query-client.js';

vi.mock('../lib/auth-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/auth-api-client.js')>();
  return { ...actual, login: vi.fn(), logout: vi.fn(), verifyEmail: vi.fn() };
});

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return {
    ...actual,
    listPages: vi.fn(),
    getPage: vi.fn(),
    createPage: vi.fn(),
  };
});

const samplePage: PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  locale: 'it',
  slug: 'home',
  status: 'published',
  content: [],
  publishedContent: [],
  seoMeta: { title: 'Home', description: '' },
  createdAt: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderApp(initialPath: string) {
  const queryClient = createTestQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('router', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('redirects an unauthenticated visitor from / to /login', async () => {
    vi.mocked(api.listPages).mockRejectedValue(
      new ApiError(401, { message: 'Unauthorized' }),
    );

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeTruthy();
  });

  it('renders the pages list inside the shell when authenticated', async () => {
    vi.mocked(api.listPages).mockResolvedValue({
      items: [samplePage],
      total: 1,
    });

    renderApp('/pages');

    expect(await screen.findByRole('link', { name: 'Pagine' })).toBeTruthy();
    expect(screen.getByText('home')).toBeTruthy();
    expect(screen.getByText('Media')).toBeTruthy();
  });

  it('redirects to /login when opening a page editor while unauthenticated', async () => {
    vi.mocked(api.getPage).mockRejectedValue(
      new ApiError(401, { message: 'Unauthorized' }),
    );

    renderApp('/pages/page-1');

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeTruthy();
  });

  it('navigates from the pages list to the editor and back', async () => {
    vi.mocked(api.listPages).mockResolvedValue({
      items: [samplePage],
      total: 1,
    });
    vi.mocked(api.getPage).mockResolvedValue(samplePage);

    renderApp('/pages');
    fireEvent.click(await screen.findByRole('button', { name: /home/i }));
    fireEvent.click(screen.getByRole('button', { name: /apri editor/i }));

    expect(await screen.findByRole('link', { name: /pagine/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: /pagine/i }));
    expect(await screen.findByText('home')).toBeTruthy();
  });

  it('renders the reset-password form with the token from the URL', async () => {
    renderApp('/reset-password?resetToken=abc123');

    expect(
      await screen.findByRole('heading', { name: 'Reimposta la password' }),
    ).toBeTruthy();
  });

  it('renders the verify-email view with the token from the URL', async () => {
    vi.mocked(authApi.verifyEmail).mockReturnValue(
      new Promise(() => undefined),
    );

    renderApp('/verify-email?verifyToken=xyz789');

    expect(
      await screen.findByRole('heading', { name: 'Verifica email' }),
    ).toBeTruthy();
    expect(authApi.verifyEmail).toHaveBeenCalledWith('xyz789');
  });

  it('logs in and lands on the pages list', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ userId: 'user-1' });
    vi.mocked(api.listPages).mockResolvedValue({ items: [], total: 0 });

    renderApp('/login');

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'lele@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct-horse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^accedi$/i }));

    expect(await screen.findByRole('link', { name: 'Pagine' })).toBeTruthy();
    expect(authApi.login).toHaveBeenCalledWith(
      'lele@example.com',
      'correct-horse',
    );
  });

  it('logs out from the shell and returns to /login', async () => {
    vi.mocked(api.listPages).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(authApi.logout).mockResolvedValue({ success: true });

    renderApp('/pages');
    fireEvent.click(await screen.findByRole('button', { name: /^account$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^esci$/i }));

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeTruthy();
    expect(authApi.logout).toHaveBeenCalled();
  });
});
