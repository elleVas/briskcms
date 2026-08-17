import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import App from './app';
import * as api from '../lib/pages-api-client.js';

// A bare automock stubs out ApiError's constructor body too (it would
// silently drop the `status` field the 401 check depends on) — keep the
// real class, mock only the network-calling functions.
vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return {
    ...actual,
    createPage: vi.fn(),
    getPage: vi.fn(),
    saveDraft: vi.fn(),
    publishPage: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
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

  it('shows the login form when the initial load is unauthorized', async () => {
    vi.mocked(api.createPage).mockRejectedValue(
      new api.ApiError(401, { message: 'Unauthorized' }),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeTruthy();
  });
});
