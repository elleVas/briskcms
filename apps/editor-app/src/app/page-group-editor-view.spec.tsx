import type { ReactNode } from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Block } from '@brisk/shared-types';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/page-groups-api-client';
import * as previewTokenApi from '../lib/preview-token-api-client';
import { createTestQueryClient } from '../test-query-client';
import { ToastProvider } from './toast-provider';
import {
  pageGroupQueryOptions,
  pageGroupTranslationsQueryOptions,
} from './page-groups-queries';
import { PageGroupEditorView } from './page-group-editor-view';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to }: { children: ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../lib/page-groups-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/page-groups-api-client')>();
  return {
    ...actual,
    updatePageTranslationSeoMeta: vi.fn(),
    listPageGroupVersions: vi.fn(),
    rollbackPageGroupToVersion: vi.fn(),
    createPageGroupTranslation: vi.fn(),
  };
});

vi.mock('../lib/preview-token-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/preview-token-api-client')>();
  return { ...actual, createTranslationPreviewToken: vi.fn() };
});

const groupContent: Block[] = [
  { id: 'hero-1', type: 'Hero', props: { title: 'Hello' } },
];

const sampleGroup: api.PageGroupRecord = {
  id: 'group-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  parentId: null,
  order: 0,
  content: groupContent,
  createdBy: null,
  createdAt: '',
  updatedAt: '',
};

const enTranslation: api.PageTranslationRecord = {
  id: 'translation-en',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  pageGroupId: 'group-1',
  locale: 'en',
  slug: 'home',
  seoMeta: { title: 'Home', description: 'The home page' },
  fieldValues: {},
  status: 'draft',
  publishedSnapshot: null,
  isDiverged: false,
  divergedContent: null,
  createdBy: null,
  createdAt: '',
  updatedAt: '',
};

function renderView(
  translations: api.PageTranslationRecord[] = [enTranslation],
  enabledLocales: string[] = ['en', 'it'],
) {
  vi.mocked(previewTokenApi.createTranslationPreviewToken).mockResolvedValue({
    token: 'tok123',
    expiresAt: new Date().toISOString(),
  });

  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    pageGroupQueryOptions('group-1').queryKey,
    sampleGroup,
  );
  queryClient.setQueryData(
    pageGroupTranslationsQueryOptions('group-1').queryKey,
    translations,
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ToastProvider>
          <PageGroupEditorView
            groupId="group-1"
            initialLocale="en"
            defaultLocale="en"
            enabledLocales={enabledLocales}
          />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('PageGroupEditorView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the SEO dialog pre-filled with the active translation and saves an edit', async () => {
    vi.mocked(api.updatePageTranslationSeoMeta).mockResolvedValue({
      ...enTranslation,
      seoMeta: { title: 'New title', description: 'The home page' },
    });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'SEO' }));

    const titleInput = await screen.findByLabelText('Titolo SEO');
    expect(titleInput).toHaveProperty('value', 'Home');

    fireEvent.change(titleInput, { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() =>
      expect(api.updatePageTranslationSeoMeta).toHaveBeenCalledWith(
        'translation-en',
        { title: 'New title', description: 'The home page' },
        null,
      ),
    );
  });

  it('opens version history and restores a previous version', async () => {
    vi.mocked(api.listPageGroupVersions).mockResolvedValue([
      {
        id: 'v1',
        tenantId: 'tenant-1',
        pageGroupId: 'group-1',
        content: groupContent,
        createdBy: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'v2',
        tenantId: 'tenant-1',
        pageGroupId: 'group-1',
        content: [{ id: 'hero-1', type: 'Hero', props: { title: 'Old' } }],
        createdBy: null,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.rollbackPageGroupToVersion).mockResolvedValue({
      ...sampleGroup,
      content: [{ id: 'hero-1', type: 'Hero', props: { title: 'Old' } }],
    });
    renderView();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cronologia versioni' }),
    );

    const restoreButtons = await screen.findAllByRole('button', {
      name: /^ripristina$/i,
    });
    expect(restoreButtons).toHaveLength(1);
    fireEvent.click(restoreButtons[0]);

    await waitFor(() =>
      expect(api.rollbackPageGroupToVersion).toHaveBeenCalledWith(
        'group-1',
        'v1',
      ),
    );
  });

  it('opens the translations dialog, creates a translation for a missing locale, and switches to it', async () => {
    const itTranslation: api.PageTranslationRecord = {
      ...enTranslation,
      id: 'translation-it',
      locale: 'it',
      slug: 'home-it',
    };
    vi.mocked(api.createPageGroupTranslation).mockResolvedValue(itTranslation);
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Traduzioni' }));

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('en')).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'IT' }));
    fireEvent.change(dialog.getByLabelText('URL'), {
      target: { value: 'home-it' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Crea traduzione' }));

    await waitFor(() =>
      expect(api.createPageGroupTranslation).toHaveBeenCalledWith('group-1', {
        locale: 'it',
        slug: 'home-it',
        seoMeta: { title: '', description: '' },
      }),
    );
    // Switching to the newly-created locale shows it as active in the
    // language switcher (uppercase locale code in the top bar).
    await waitFor(() => expect(screen.getByText('it')).toBeTruthy());
  });
});
