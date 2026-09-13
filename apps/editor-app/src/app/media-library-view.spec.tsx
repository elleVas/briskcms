import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip';
import type { MediaDto, MediaFilters } from '../lib/media-api-client';
import { createTestQueryClient } from '../test-query-client';
import { MediaLibraryView } from './media-library-view';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: vi.fn(),
    // No router in these tests: a folder is a link, and what matters here
    // is where it points.
    Link: ({
      children,
      search,
      ...rest
    }: {
      children: React.ReactNode;
      search?: Record<string, unknown>;
      className?: string;
    }) => (
      <a
        href={`/media?${new URLSearchParams(search as Record<string, string>)}`}
        {...rest}
      >
        {children}
      </a>
    ),
  };
});

const mediaOne: MediaDto = {
  id: 'media-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  filename: 'foto.png',
  storageKey: 'abc.webp',
  storageProvider: 'local',
  mimeType: 'image/webp',
  size: 1234,
  width: 800,
  height: 600,
  createdAt: '',
  url: 'http://localhost/uploads/abc.webp',
};

const counts = { image: 21, video: 0, audio: 2, document: 3, other: 1 };

function renderView(
  items: MediaDto[],
  options: { page?: number; total?: number; filters?: MediaFilters } = {},
) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <MediaLibraryView
          siteId="site-1"
          items={items}
          page={options.page ?? 1}
          total={options.total ?? items.length}
          filters={options.filters ?? {}}
          counts={counts}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('MediaLibraryView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  /*
   * The library used to open onto every file at once. It opens onto five
   * folders now, each with how many files it holds, and no file is shown
   * until one is opened.
   */
  it('opens onto one folder per kind, each with its count and its own address', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    const { container } = renderView([mediaOne]);

    expect(screen.getByRole('heading', { name: 'Media' })).toBeTruthy();
    const folders = screen.getByRole('navigation', { name: 'Cartelle' });
    const links = [...folders.querySelectorAll('a')];
    expect(links.map((link) => link.textContent)).toEqual([
      'Immagini21 file',
      'Video0 file',
      'Audio2 file',
      'Documenti3 file',
      'Altro1 file',
    ]);
    expect(links[3].getAttribute('href')).toBe('/media?page=1&kind=document');
    // An empty folder is still there: the library's shape does not change
    // with its contents.
    expect(links[1].textContent).toContain('0 file');
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it("shows a folder's files under a way back to the folders", () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    const { container } = renderView([mediaOne], {
      filters: { kind: 'image' },
    });

    expect(screen.getByRole('heading', { name: 'Immagini (21)' })).toBeTruthy();
    const trail = screen.getByRole('navigation', { name: 'Dove ti trovi' });
    expect(trail.querySelector('a')?.getAttribute('href')).toBe(
      '/media?page=1',
    );
    expect(container.querySelectorAll('img')).toHaveLength(1);
    // The folder is the choice of kind; offering the kind buttons again
    // inside it would ask the same question twice.
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('searches every folder when the search is typed at the front door', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([mediaOne], { filters: { search: 'foto' } });

    expect(
      screen.getByRole('heading', { name: 'Risultati della ricerca' }),
    ).toBeTruthy();
    expect(screen.getByText('foto.png')).toBeTruthy();
  });

  /*
   * The search lives in the address on purpose — one worth doing is worth
   * reloading into and sending to somebody — but writing it there on every
   * keystroke meant a history entry and a loader round trip per character:
   * six of each to type "report", and six presses of Back to leave the
   * screen. The pages list had already written that lesson down.
   */
  it('waits for the typing to settle before touching the address', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    renderView([mediaOne]);
    const box = screen.getByLabelText('Cerca per nome');

    fireEvent.change(box, { target: { value: 'r' } });
    fireEvent.change(box, { target: { value: 're' } });
    fireEvent.change(box, { target: { value: 'rep' } });

    // What was typed is on screen straight away, whatever the address says.
    expect((box as HTMLInputElement).value).toBe('rep');
    expect(navigate).not.toHaveBeenCalled();

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith({
      to: '/media',
      search: { page: 1, search: 'rep', kind: undefined },
      // One search, one history entry — not one per character.
      replace: true,
    });
  });

  it('navigates via /media search params when paging', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);

    renderView([mediaOne], {
      page: 2,
      total: 100,
      filters: { kind: 'image' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pagina successiva/i }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/media',
        search: { kind: 'image', page: 3 },
      }),
    );
  });
});
