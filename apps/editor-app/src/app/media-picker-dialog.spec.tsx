import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip.js';
import * as api from '../lib/media-api-client.js';
import type { MediaDto } from '../lib/media-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { MediaPickerDialog } from './media-picker-dialog.js';

vi.mock('../lib/media-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/media-api-client.js')>();
  return { ...actual, listMedia: vi.fn(), uploadMedia: vi.fn() };
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

  it('is not rendered when closed', () => {
    vi.mocked(api.listMedia).mockResolvedValue({ items: [], total: 0 });

    renderDialog({ open: false });

    expect(screen.queryByText(/scegli un.immagine/i)).toBeNull();
  });

  it('loads and shows the media library when open', async () => {
    vi.mocked(api.listMedia).mockResolvedValue({
      items: [mediaOne],
      total: 1,
    });

    renderDialog();

    expect(
      await screen.findByRole('heading', { name: /scegli un.immagine/i }),
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
