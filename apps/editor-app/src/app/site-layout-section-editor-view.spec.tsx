import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as sectionsApi from '../lib/site-layout-sections-api-client.js';
import type { SiteLayoutSectionDto } from '../lib/site-layout-sections-api-client.js';
import { TooltipProvider } from '../components/ui/tooltip.js';
import { createTestQueryClient } from '../test-query-client.js';
import { siteLayoutSectionQueryOptions } from './site-layout-sections-queries.js';
import { SiteLayoutSectionEditorView } from './site-layout-section-editor-view.js';

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
  };
});

vi.mock('../lib/site-layout-sections-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../lib/site-layout-sections-api-client.js')
    >();
  return {
    ...actual,
    listVersions: vi.fn(),
    rollbackToVersion: vi.fn(),
  };
});

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return { ...actual, listPages: vi.fn() };
});

const sampleSection: SiteLayoutSectionDto = {
  id: 'section-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  locale: 'it',
  kind: 'header',
  status: 'draft',
  content: [],
  publishedContent: null,
  createdAt: '',
  updatedAt: '',
};

function renderView() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    siteLayoutSectionQueryOptions('site-1', 'it', 'header').queryKey,
    sampleSection,
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SiteLayoutSectionEditorView
          siteId="site-1"
          locale="it"
          kind="header"
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('SiteLayoutSectionEditorView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a link back to Aspetto', () => {
    renderView();

    expect(
      screen.getByRole('link', { name: /aspetto/i }).getAttribute('href'),
    ).toBe('/appearance');
  });

  it('opens the version history dialog and lists past versions newest-first', async () => {
    vi.mocked(sectionsApi.listVersions).mockResolvedValue([
      {
        id: 'v1',
        tenantId: 'tenant-1',
        siteLayoutSectionId: 'section-1',
        content: [],
        createdBy: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'v2',
        tenantId: 'tenant-1',
        siteLayoutSectionId: 'section-1',
        content: [],
        createdBy: null,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    renderView();
    fireEvent.click(
      screen.getByRole('button', { name: /cronologia versioni/i }),
    );

    await waitFor(() =>
      expect(sectionsApi.listVersions).toHaveBeenCalledWith('section-1'),
    );
    const restoreButtons = await screen.findAllByRole('button', {
      name: /^ripristina$/i,
    });
    expect(restoreButtons).toHaveLength(1);
    expect(screen.getByText(/versione attuale/i)).toBeTruthy();
  });
});
