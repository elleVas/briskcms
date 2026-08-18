import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as router from '@tanstack/react-router';
import * as authApi from '../lib/auth-api-client.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { PageEditorView } from './page-editor-view.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
    }: {
      children: ReactNode;
      to: string;
      className?: string;
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
    useNavigate: vi.fn(),
  };
});

vi.mock('../lib/auth-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/auth-api-client.js')>();
  return { ...actual, logout: vi.fn() };
});

const samplePage: PageDto = {
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

describe('PageEditorView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a link back to the pages list', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    render(<PageEditorView page={samplePage} />);

    expect(
      screen.getByRole('link', { name: /pagine/i }).getAttribute('href'),
    ).toBe('/pages');
  });

  it('logs out and navigates to /login when Esci is clicked', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(authApi.logout).mockResolvedValue({ success: true });

    render(<PageEditorView page={samplePage} />);
    fireEvent.click(screen.getByRole('button', { name: /^esci$/i }));

    await waitFor(() => expect(authApi.logout).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith({ to: '/login' });
  });
});
