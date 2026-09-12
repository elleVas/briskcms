import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { createTestQueryClient } from '../test-query-client';
import * as auth from '../lib/auth-api-client';
import * as collectionsApi from '../lib/collections-api-client';
import { AdminShell } from './admin-shell';

vi.mock('../lib/collections-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/collections-api-client')>();
  return { ...actual, listCollections: vi.fn().mockResolvedValue([]) };
});

vi.mock('../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client')>();
  return {
    ...actual,
    getCurrentSite: vi.fn().mockResolvedValue({
      id: 'site-1',
      defaultLocale: 'it',
      enabledLocales: ['it'],
    }),
  };
});

vi.mock('../lib/auth-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/auth-api-client')>();
  return { ...actual, currentSession: vi.fn() };
});

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    // Mimics the real Link closely enough for the active-item test below:
    // the router marks the current link with `data-status="active"` and
    // CONCATENATES `activeProps.className` onto `className`. Pages stands
    // in for "the screen you are on".
    Link: ({
      children,
      to,
      className,
      activeProps,
    }: {
      children: ReactNode;
      to: string;
      className?: string;
      activeProps?: { className?: string };
    }) => {
      const isActive = to === '/pages';
      return (
        <a
          href={to}
          data-status={isActive ? 'active' : undefined}
          className={
            isActive && activeProps?.className
              ? `${className ?? ''} ${activeProps.className}`
              : className
          }
        >
          {children}
        </a>
      );
    },
    useNavigate: vi.fn(),
  };
});

function renderShell(role: 'admin' | 'publisher' | 'editor' = 'admin') {
  vi.mocked(auth.currentSession).mockResolvedValue({
    userId: 'user-1',
    email: 'chi@esempio.it',
    role,
  });
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AdminShell>
        <p>content</p>
      </AdminShell>
    </QueryClientProvider>,
  );
}

describe('AdminShell', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  /*
   * The sidebar used to offer every screen to everybody and let the API
   * say no after the click: an Editor saw Utenti, opened it, and got a
   * generic error page. The server refusing is right; the sidebar
   * pretending the door is open is not.
   */
  it.each(['publisher', 'editor'] as const)(
    'does not offer Utenti to a %s',
    async (role) => {
      vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

      renderShell(role);

      // The rest of the sidebar is there, so this is about Utenti and not
      // about the shell failing to render at all.
      expect(await screen.findByRole('link', { name: 'Pagine' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Utenti' })).toBeNull();
    },
  );

  /*
   * The user's own line: pages and news must not be mixed, even though
   * underneath they are the same thing. A section is a menu entry.
   */
  it('gives every section of the site an entry of its own, under Pagine', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(collectionsApi.listCollections).mockResolvedValue([
      {
        id: 'collection-1',
        tenantId: 'tenant-1',
        siteId: 'site-1',
        name: 'News',
        icon: 'newspaper',
        order: 0,
        createdAt: '',
        updatedAt: '',
      },
    ]);

    renderShell('admin');

    const entry = await screen.findByRole('link', { name: 'News' });
    expect(entry.getAttribute('href')).toBe('/collections/$collectionId');
  });

  it('offers Utenti to an admin', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell('admin');

    expect(
      (await screen.findByRole('link', { name: 'Utenti' })).getAttribute(
        'href',
      ),
    ).toBe('/users');
  });

  /*
   * While the role is still unknown — loading, or the request failed —
   * the admin-only entries stay hidden. Guessing generously would put
   * back exactly what this hides.
   */
  it('hides Utenti until it knows who is asking', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(auth.currentSession).mockReturnValue(
      new Promise(() => undefined),
    );

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AdminShell>
          <p>content</p>
        </AdminShell>
      </QueryClientProvider>,
    );

    expect(screen.queryByRole('link', { name: 'Utenti' })).toBeNull();
  });

  it('renders links to Pagine, Media, Layout, Stile and Utenti, and separate Impostazioni/Account menus', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell();

    expect(
      screen.getByRole('link', { name: 'Pagine' }).getAttribute('href'),
    ).toBe('/pages');
    expect(
      screen.getByRole('link', { name: 'Media' }).getAttribute('href'),
    ).toBe('/media');
    expect(
      screen.getByRole('link', { name: 'Layout' }).getAttribute('href'),
    ).toBe('/layout');
    expect(
      screen.getByRole('link', { name: 'Stile' }).getAttribute('href'),
    ).toBe('/style');
    // Awaited, not synchronous: this entry now waits to know the role.
    expect(
      (await screen.findByRole('link', { name: 'Utenti' })).getAttribute(
        'href',
      ),
    ).toBe('/users');
    expect(screen.getByText('content')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^impostazioni$/i }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^account$/i })).toBeTruthy();
  });

  it('exposes the language/theme toggles inside Impostazioni', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /^impostazioni$/i }));

    expect(screen.getByRole('switch', { name: /lingua/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /tema scuro/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^esci$/i })).toBeNull();
  });

  /*
   * The active entry said where you were with its background alone. Its
   * colour came in as `activeProps.className`, which the router appends to
   * `className` — so `text-muted-foreground` and `text-foreground` sat in
   * one attribute, where being written second wins nothing, and the
   * computed colour of the current screen's entry was the muted one, the
   * same as every other entry's.
   */
  it('colours the active nav item through a variant, not a second class', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell();
    const active = screen.getByRole('link', { name: 'Pagine' });

    expect(active.getAttribute('data-status')).toBe('active');
    expect(active.className).toContain('data-[status=active]:text-foreground');
    // The point of the fix: nothing hands the link a bare colour that has
    // to out-order another bare colour in the same attribute.
    expect(active.className.split(/\s+/)).not.toContain('text-foreground');
  });

  it('exposes logout inside Account', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /^account$/i }));

    expect(screen.getByRole('button', { name: /^esci$/i })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /lingua/i })).toBeNull();
  });
});
