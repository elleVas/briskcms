import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/media-api-client';
import type { MediaDto } from '../lib/media-api-client';
import { createTestQueryClient } from '../test-query-client';
import { MediaGrid } from './media-grid';

vi.mock('../lib/media-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/media-api-client')>();
  return { ...actual, uploadMedia: vi.fn(), deleteMedia: vi.fn() };
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

function renderGrid(props: Partial<ComponentProps<typeof MediaGrid>> = {}) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <MediaGrid
          siteId="site-1"
          items={[mediaOne]}
          page={1}
          total={1}
          onPageChange={vi.fn()}
          filters={{}}
          onFiltersChange={vi.fn()}
          {...props}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('MediaGrid', () => {
  /*
   * The grid was thumbnails and nothing else: no name, no kind, no size,
   * no date. With nineteen files it was already a wall of dark rectangles
   * — every screenshot in the docs is a black image — and the only way to
   * find one was to recognise it by sight.
   */
  it('names every file, with its format and size', () => {
    renderGrid();

    expect(screen.getByText('foto.png')).toBeTruthy();
    expect(screen.getByText(/WEBP/)).toBeTruthy();
    expect(screen.getByText(/1\.2 KB/)).toBeTruthy();
  });

  it('asks the caller for a new search rather than filtering the page it was given', () => {
    const onFiltersChange = vi.fn();
    renderGrid({ onFiltersChange });

    fireEvent.change(
      screen.getByRole('searchbox', { name: /cerca per nome/i }),
      {
        target: { value: 'foto' },
      },
    );

    // The server answers it: the library is paginated, so filtering what
    // came back would search the newest page and stay silent about the rest.
    expect(onFiltersChange).toHaveBeenCalledWith({ search: 'foto' });
  });

  it('narrows to one kind of file', () => {
    const onFiltersChange = vi.fn();
    renderGrid({ onFiltersChange });

    fireEvent.click(screen.getByRole('radio', { name: 'Video' }));

    expect(onFiltersChange).toHaveBeenCalledWith({ kind: 'video' });
  });

  it('says "nothing matches" rather than "no files yet" when a filter is on', () => {
    renderGrid({ items: [], total: 0, filters: { search: 'zzz' } });

    // "No files yet" would send somebody off to upload what they already
    // have.
    expect(screen.getByText(/nessun file corrisponde/i)).toBeTruthy();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no items', () => {
    renderGrid({ items: [], total: 0 });

    expect(screen.getByText(/nessun file/i)).toBeTruthy();
  });

  it('renders a thumbnail for every item', () => {
    const { container } = renderGrid();

    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('uploads the picked file', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(mediaOne);
    const { container } = renderGrid();

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['data'], 'nuova.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(api.uploadMedia).toHaveBeenCalledWith('site-1', file),
    );
  });

  it('calls onSelect when a thumbnail is clicked in picker mode', () => {
    const onSelect = vi.fn();
    renderGrid({ onSelect });

    fireEvent.click(screen.getByRole('button', { name: 'foto.png' }));

    expect(onSelect).toHaveBeenCalledWith(mediaOne);
  });

  it('has no selectable thumbnail button when onSelect is not provided', () => {
    renderGrid();

    expect(screen.queryByRole('button', { name: 'foto.png' })).toBeNull();
  });

  it('deletes the media after confirming, in library mode', async () => {
    vi.mocked(api.deleteMedia).mockResolvedValue(undefined);
    renderGrid({ showDelete: true });

    fireEvent.click(screen.getByRole('button', { name: /elimina/i }));
    expect(screen.getByText(/eliminare questo file/i)).toBeTruthy();
    // The background delete icon is aria-hidden while the modal is open,
    // so only the dialog's own confirm button is accessible here.
    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    await waitFor(() =>
      expect(api.deleteMedia).toHaveBeenCalledWith(mediaOne.id),
    );
  });

  it('has no delete control when showDelete is false', () => {
    renderGrid({ showDelete: false });

    expect(screen.queryByRole('button', { name: /elimina/i })).toBeNull();
  });

  it('has no pagination controls when everything fits on one page', () => {
    renderGrid({ total: 1 });

    expect(screen.queryByText(/pagina 1 di/i)).toBeNull();
  });

  it('navigates to the next/previous page', () => {
    const onPageChange = vi.fn();
    renderGrid({ page: 2, total: 100, onPageChange });

    expect(screen.getByText(/pagina 2 di/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /pagina successiva/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('button', { name: /pagina precedente/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
