import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/media-api-client';
import { createTestQueryClient } from '../test/query-client.test-fixture';
import { buildMediaRecord } from '@brisk/testing/records';
import { MediaPickerDialog } from './media-picker-dialog';

vi.mock('../lib/media-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/media-api-client')>();
  return { ...actual, listMedia: vi.fn(), uploadMedia: vi.fn() };
});

const mediaOne = buildMediaRecord();

function renderDialog(
  props: Partial<Omit<ComponentProps<typeof MediaPickerDialog>, 'siteId'>> = {},
) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <MediaPickerDialog
          siteId="site-1"
          open
          onOpenChange={vi.fn()}
          onSelect={vi.fn()}
          {...props}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('MediaPickerDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  /*
   * Every field used to open the same picker with everything in it: a
   * video field could be given a photo, a poster a video, and — once the
   * library took any file (ADR-0070) — an image field a PDF. The field
   * now says what it takes, and the SERVER is asked for only that.
   */
  it('asks the server only for the kind the field can use, and says so', async () => {
    vi.mocked(api.listMedia).mockResolvedValue({ items: [], total: 0 });

    renderDialog({ lockedKind: 'video' });

    await waitFor(() =>
      expect(api.listMedia).toHaveBeenCalledWith(
        'site-1',
        1,
        expect.any(Number),
        expect.objectContaining({ kind: 'video' }),
      ),
    );
    expect(screen.getByText('Scegli un video')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('is not rendered when closed', () => {
    vi.mocked(api.listMedia).mockResolvedValue({ items: [], total: 0 });

    renderDialog({ open: false });

    expect(screen.queryByText(/scegli un file/i)).toBeNull();
  });

  it('loads and shows the media library when open', async () => {
    vi.mocked(api.listMedia).mockResolvedValue({
      items: [mediaOne],
      total: 1,
    });

    renderDialog();

    expect(
      await screen.findByRole('heading', { name: /scegli un file/i }),
    ).toBeTruthy();
    // DialogContent renders via a Radix Portal (outside the local render
    // container), so query the whole document via `screen`, not `container`.
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
  });

  it('calls onSelect with the clicked media', async () => {
    vi.mocked(api.listMedia).mockResolvedValue({
      items: [mediaOne],
      total: 1,
    });
    const onSelect = vi.fn();

    renderDialog({ onSelect });
    fireEvent.click(await screen.findByRole('button', { name: 'foto.png' }));

    expect(onSelect).toHaveBeenCalledWith(mediaOne);
  });
});
