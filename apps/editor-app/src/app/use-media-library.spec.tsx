import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/media-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { useMediaLibrary } from './use-media-library.js';

vi.mock('../lib/media-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/media-api-client.js')>();
  return { ...actual, uploadMedia: vi.fn(), deleteMedia: vi.fn() };
});

const sampleMedia: api.MediaDto = {
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

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe('useMediaLibrary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uploadMedia uploads the file for the given site', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(sampleMedia);
    const file = new File(['data'], 'foto.png', { type: 'image/png' });

    const { result } = renderHook(() => useMediaLibrary('site-1'), {
      wrapper,
    });

    await act(async () => {
      await result.current.uploadMedia(file);
    });

    expect(api.uploadMedia).toHaveBeenCalledWith('site-1', file);
  });

  it('deleteMedia removes the given media', async () => {
    vi.mocked(api.deleteMedia).mockResolvedValue(undefined);

    const { result } = renderHook(() => useMediaLibrary('site-1'), {
      wrapper,
    });

    await act(async () => {
      await result.current.deleteMedia('media-1');
    });

    expect(api.deleteMedia).toHaveBeenCalledWith('media-1');
  });
});
