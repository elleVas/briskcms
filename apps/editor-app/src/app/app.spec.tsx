import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import App from './app';
import * as authApi from '../lib/auth-api-client.js';
import { ApiError } from '../lib/http-client.js';
import * as api from '../lib/pages-api-client.js';

// A bare automock stubs out ApiError's constructor body too (it would
// silently drop the `status` field the 401 check depends on) — keep the
// real class (imported directly above, from http-client.js, so it's never
// touched by either mock), mock only the network-calling functions.
vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return {
    ...actual,
    createPage: vi.fn(),
    getPage: vi.fn(),
    saveDraft: vi.fn(),
    publishPage: vi.fn(),
  };
});

vi.mock('../lib/auth-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/auth-api-client.js')>();
  return {
    ...actual,
    login: vi.fn(),
    logout: vi.fn(),
    verifyEmail: vi.fn(),
  };
});

const samplePage: api.PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  locale: 'it',
  slug: 'test-page',
  status: 'draft',
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Test', description: 'desc' },
  createdAt: '',
  updatedAt: '',
};

describe('App', () => {
  beforeEach(() => {
    // The "creates a page" test's success path calls history.replaceState
    // to add ?pageId=... to the URL — without resetting it, that state
    // leaks into later tests via jsdom's shared window.location.
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a loading state before the page has loaded', () => {
    vi.mocked(api.createPage).mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(screen.getByText('Caricamento...')).toBeTruthy();
  });

  it('creates a page and renders the editor once it loads', async () => {
    vi.mocked(api.createPage).mockResolvedValue(samplePage);

    render(<App />);

    await waitFor(() =>
      expect(screen.queryByText('Caricamento...')).toBeNull(),
    );
    expect(api.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: expect.any(String) }),
    );
  });

  it('logs out from the editor view and returns to the login form', async () => {
    vi.mocked(api.createPage).mockResolvedValue(samplePage);
    vi.mocked(authApi.logout).mockResolvedValue({ success: true });

    render(<App />);
    await waitFor(() =>
      expect(screen.queryByText('Caricamento...')).toBeNull(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^esci$/i }));

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeTruthy();
    expect(authApi.logout).toHaveBeenCalled();
  });

  it('shows the login form when the initial load is unauthorized', async () => {
    vi.mocked(api.createPage).mockRejectedValue(
      new ApiError(401, { message: 'Unauthorized' }),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeTruthy();
  });

  it('shows the reset password form when the URL has a resetToken, regardless of auth state', () => {
    // Never resolves — the resetToken branch must render before (and
    // independently of) whatever the page-load call eventually does.
    vi.mocked(api.createPage).mockReturnValue(new Promise(() => undefined));
    window.history.pushState({}, '', '/?resetToken=abc123');

    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Reimposta la password' }),
    ).toBeTruthy();
  });

  it('shows the verify email view when the URL has a verifyToken', () => {
    // Never resolve either call — this test only checks the initial
    // synchronous render, not what happens once either settles.
    vi.mocked(api.createPage).mockReturnValue(new Promise(() => undefined));
    vi.mocked(authApi.verifyEmail).mockReturnValue(
      new Promise(() => undefined),
    );
    window.history.pushState({}, '', '/?verifyToken=xyz789');

    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Verifica email' }),
    ).toBeTruthy();
  });

  it('toggles between the login and forgot-password views', async () => {
    vi.mocked(api.createPage).mockRejectedValue(
      new ApiError(401, { message: 'Unauthorized' }),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /password dimenticata/i }),
    );
    expect(
      screen.getByRole('heading', { name: 'Password dimenticata' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /torna al login/i }));
    expect(screen.getByRole('heading', { name: 'Accedi' })).toBeTruthy();
  });
});
