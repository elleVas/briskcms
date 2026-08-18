import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as router from '@tanstack/react-router';
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

  it('renders a link back to the pages list and a logout control', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    render(<PageEditorView page={samplePage} />);

    expect(
      screen.getByRole('link', { name: /pagine/i }).getAttribute('href'),
    ).toBe('/pages');
    expect(screen.getByRole('button', { name: /^esci$/i })).toBeTruthy();
  });
});
