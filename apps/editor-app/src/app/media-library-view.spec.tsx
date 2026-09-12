import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip';
import type { MediaDto } from '../lib/media-api-client';
import { createTestQueryClient } from '../test-query-client';
import { MediaLibraryView } from './media-library-view';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
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

function renderView(
  items: MediaDto[],
  options: { page?: number; total?: number } = {},
) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <MediaLibraryView
          siteId="site-1"
          items={items}
          page={options.page ?? 1}
          total={options.total ?? items.length}
          filters={{}}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('MediaLibraryView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title and the media grid', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    const { container } = renderView([mediaOne]);

    expect(screen.getByRole('heading', { name: 'Media' })).toBeTruthy();
    expect(container.querySelectorAll('img')).toHaveLength(1);
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

    renderView([mediaOne], { page: 2, total: 100 });
    fireEvent.click(screen.getByRole('button', { name: /pagina successiva/i }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/media',
        search: { page: 3 },
      }),
    );
  });
});
