import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMediaPicker } from '@brisk/block-registry';
import type { PickedMedia } from '@brisk/shared-types';
import { TooltipProvider } from '../components/ui/tooltip.js';
import * as api from '../lib/media-api-client.js';
import type { MediaDto } from '../lib/media-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { MediaPickerProvider } from './media-picker-provider.js';

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

function PickerConsumer() {
  const { pick } = useMediaPicker();
  const [result, setResult] = useState<PickedMedia | null | 'pending'>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setResult('pending');
          void pick().then(setResult);
        }}
      >
        Apri picker
      </button>
      <p>{result === 'pending' || result === null ? '' : result.url}</p>
    </div>
  );
}

function renderProvider() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <MediaPickerProvider siteId="site-1">
          <PickerConsumer />
        </MediaPickerProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('MediaPickerProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the dialog on pick() and resolves with the selected media', async () => {
    vi.mocked(api.listMedia).mockResolvedValue({
      items: [mediaOne],
      total: 1,
    });

    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Apri picker' }));

    fireEvent.click(await screen.findByRole('button', { name: 'foto.png' }));

    await waitFor(() => expect(screen.getByText(mediaOne.url)).toBeTruthy());
    // The dialog closes itself once a selection resolves the pick().
    expect(screen.queryByRole('heading', { name: /scegli/i })).toBeNull();
  });

  it('resolves with null when the dialog is dismissed without a selection', async () => {
    vi.mocked(api.listMedia).mockResolvedValue({ items: [], total: 0 });

    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Apri picker' }));
    await screen.findByRole('heading', { name: /scegli/i });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
      code: 'Escape',
    });

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /scegli/i })).toBeNull(),
    );
  });
});
