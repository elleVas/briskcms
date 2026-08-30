import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip';
import * as authApi from '../lib/auth-api-client';
import * as formsApi from '../lib/forms-api-client';
import * as mediaApi from '../lib/media-api-client';
import * as api from '../lib/pages-api-client';
import * as sectionsApi from '../lib/site-layout-sections-api-client';
import * as sitesApi from '../lib/sites-api-client';
import * as usersApi from '../lib/users-api-client';
import { ApiError } from '../lib/http-client';
import type { FormDto } from '../lib/forms-api-client';
import type { PageRecord } from '../lib/pages-api-client';
import type { SiteLayoutSectionDto } from '../lib/site-layout-sections-api-client';
import type { UserDto } from '../lib/users-api-client';
import type { SiteRecord } from '@brisk/shared-types';
import { routeTree } from '../routeTree.gen';
import { createTestQueryClient } from '../test-query-client';

vi.mock('../lib/auth-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/auth-api-client')>();
  return {
    ...actual,
    login: vi.fn(),
    logout: vi.fn(),
    verifyEmail: vi.fn(),
    acceptInvite: vi.fn(),
  };
});

vi.mock('../lib/pages-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client')>();
  return {
    ...actual,
    listPages: vi.fn(),
    getPage: vi.fn(),
    createPage: vi.fn(),
  };
});

vi.mock('../lib/media-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/media-api-client')>();
  return { ...actual, listMedia: vi.fn() };
});

vi.mock('../lib/forms-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/forms-api-client')>();
  return { ...actual, listForms: vi.fn(), getForm: vi.fn() };
});

vi.mock('../lib/users-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/users-api-client')>();
  return { ...actual, listUsers: vi.fn() };
});

vi.mock('../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client')>();
  return { ...actual, getSite: vi.fn() };
});

vi.mock('../lib/site-layout-sections-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../lib/site-layout-sections-api-client')
    >();
  return { ...actual, getOrCreateSiteLayoutSection: vi.fn() };
});

const sampleSite: SiteRecord = {
  id: 'site-1',
  tenantId: 'tenant-1',
  name: 'Il mio sito',
  domain: null,
  defaultLocale: 'it',
  enabledLocales: ['it'],
  untranslatedPageFallback: 'redirect-to-default',
  businessAddress: null,
  businessPhone: null,
  businessType: null,
  openingHours: null,
  searchEngineIndexingEnabled: false,
  themePrimaryColor: null,
  themeSecondaryColor: null,
  themeFontFamily: null,
  themeCustomCss: null,
  themeHeadScript: null,
  themeBodyScript: null,
  themeFaviconUrl: null,
  themeOverridesEnabled: true,
  themeAllowedTrackerDomains: [],
  themeTokens: { blockStyles: {} },
  createdAt: '',
};

// Not explicitly typed PageRecord: used both as a full getPage() mock and as
// a listPages() item (PageListItem), so it carries every field either
// shape needs — TypeScript checks structural compatibility at each call
// site, not against a single declared type here.
const samplePage: PageRecord & { hasUnpublishedChanges: boolean } = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'home',
  status: 'published',
  syncedStructureSignature: null,
  content: [],
  publishedContent: [],
  seoMeta: { title: 'Home', description: '' },
  createdAt: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hasUnpublishedChanges: false,
};

const sampleHeaderSection: SiteLayoutSectionDto = {
  id: 'section-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  locale: 'it',
  kind: 'header',
  status: 'draft',
  content: [],
  publishedContent: null,
  sticky: false,
  createdAt: '',
  updatedAt: '',
};

const sampleFooterSection: SiteLayoutSectionDto = {
  ...sampleHeaderSection,
  id: 'section-2',
  kind: 'footer',
};

const sampleForm: FormDto = {
  id: 'form-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  name: 'Contact form',
  fields: [],
  steps: [],
  notificationEmail: null,
  createdAt: '',
  updatedAt: '',
};

const sampleUser: UserDto = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'editor@example.com',
  displayName: 'Editor',
  role: 'editor',
  isActive: true,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '',
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
  beforeEach(() => {
    vi.mocked(sitesApi.getSite).mockResolvedValue(sampleSite);
  });

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

  it('renders the media library inside the shell when authenticated', async () => {
    vi.mocked(mediaApi.listMedia).mockResolvedValue({ items: [], total: 0 });

    renderApp('/media');

    expect(await screen.findByRole('heading', { name: 'Media' })).toBeTruthy();
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
      'fake-turnstile-token-for-tests',
    );
  });

  it('navigates from Layout to the Header editor and back', async () => {
    vi.mocked(api.listPages).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(sectionsApi.getOrCreateSiteLayoutSection).mockResolvedValue(
      sampleHeaderSection,
    );

    renderApp('/layout');
    expect(await screen.findByRole('heading', { name: 'Layout' })).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: /modifica header/i }));

    expect(await screen.findByRole('link', { name: /layout/i })).toBeTruthy();
    expect(sectionsApi.getOrCreateSiteLayoutSection).toHaveBeenCalledWith(
      expect.any(String),
      'it',
      'header',
    );

    fireEvent.click(screen.getByRole('link', { name: /layout/i }));
    expect(await screen.findByRole('heading', { name: 'Layout' })).toBeTruthy();
  });

  it('navigates to the dedicated Stile page from the sidebar', async () => {
    vi.mocked(api.listPages).mockResolvedValue({ items: [], total: 0 });

    renderApp('/pages');
    expect(await screen.findByRole('heading', { name: 'Pagine' })).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: /^stile$/i }));

    expect(
      await screen.findByRole('heading', { name: /stile del sito/i }),
    ).toBeTruthy();
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

  it('renders the forms list inside the shell when authenticated', async () => {
    vi.mocked(formsApi.listForms).mockResolvedValue({
      items: [sampleForm],
      total: 1,
    });

    renderApp('/forms');

    expect(await screen.findByRole('heading', { name: 'Moduli' })).toBeTruthy();
    expect(screen.getByText('Contact form')).toBeTruthy();
  });

  it('redirects to /login when opening the forms list while unauthenticated', async () => {
    vi.mocked(formsApi.listForms).mockRejectedValue(
      new ApiError(401, { message: 'Unauthorized' }),
    );

    renderApp('/forms');

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeTruthy();
  });

  it('renders the form editor for a given formId when authenticated', async () => {
    vi.mocked(formsApi.getForm).mockResolvedValue(sampleForm);

    renderApp('/forms/form-1');

    expect(await screen.findByLabelText('Nome modulo')).toHaveProperty(
      'value',
      'Contact form',
    );
  });

  it('redirects to /login when opening a form editor while unauthenticated', async () => {
    vi.mocked(formsApi.getForm).mockRejectedValue(
      new ApiError(401, { message: 'Unauthorized' }),
    );

    renderApp('/forms/form-1');

    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeTruthy();
  });

  it('renders the users list inside the shell when authenticated', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue({
      items: [sampleUser],
      total: 1,
    });

    renderApp('/users');

    expect(await screen.findByRole('heading', { name: 'Utenti' })).toBeTruthy();
    expect(screen.getByText('editor@example.com')).toBeTruthy();
  });

  it('renders the style settings page on direct navigation when authenticated', async () => {
    renderApp('/style');

    expect(
      await screen.findByRole('heading', { name: /stile del sito/i }),
    ).toBeTruthy();
  });

  it('renders the integrations page on direct navigation when authenticated', async () => {
    renderApp('/integrations');

    expect(
      await screen.findByRole('heading', { name: /integrazioni/i }),
    ).toBeTruthy();
  });

  it('renders the footer editor with the site default locale', async () => {
    vi.mocked(api.listPages).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(sectionsApi.getOrCreateSiteLayoutSection).mockResolvedValue(
      sampleFooterSection,
    );

    renderApp('/layout/footer');

    expect(await screen.findByText(/Modifica Footer/)).toBeTruthy();
    expect(sectionsApi.getOrCreateSiteLayoutSection).toHaveBeenCalledWith(
      expect.any(String),
      'it',
      'footer',
    );
  });

  it('renders the accept-invite form with the token from the URL', async () => {
    vi.mocked(authApi.acceptInvite).mockResolvedValue({ success: true });

    renderApp('/accept-invite?inviteToken=invite-abc');

    expect(
      await screen.findByRole('heading', { name: 'Completa la registrazione' }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a-new-password' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Completa la registrazione' }),
    );

    expect(
      await screen.findByText('Password impostata. Puoi accedere ora.'),
    ).toBeTruthy();
    expect(authApi.acceptInvite).toHaveBeenCalledWith(
      'invite-abc',
      'a-new-password',
    );
  });
});
