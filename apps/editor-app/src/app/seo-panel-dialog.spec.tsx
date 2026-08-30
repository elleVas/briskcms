import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { MediaPickerContext } from '@brisk/block-registry';
import type { PickedMedia } from '@brisk/shared-types';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/pages-api-client';
import type { PageRecord } from '../lib/pages-api-client';
import { createTestQueryClient } from '../test-query-client';
import { SeoPanelDialog } from './seo-panel-dialog';

vi.mock('../lib/pages-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client')>();
  return { ...actual, updateSeoMeta: vi.fn() };
});

const samplePage: PageRecord = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'chi-siamo',
  status: 'draft',
  syncedStructureSignature: null,
  content: [],
  publishedContent: null,
  seoMeta: {
    title: 'Chi siamo',
    description: 'La nostra storia',
    canonical: 'https://example.com/chi-siamo',
  },
  createdAt: '',
  updatedAt: '',
};

function renderDialog(
  pick: () => Promise<PickedMedia | null> = vi.fn(),
  open = true,
  onOpenChange = vi.fn(),
) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <MediaPickerContext.Provider value={{ pick }}>
          <SeoPanelDialog
            pageId="page-1"
            seoMeta={samplePage.seoMeta}
            open={open}
            onOpenChange={onOpenChange}
          />
        </MediaPickerContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('SeoPanelDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pre-fills the form with the current seoMeta', () => {
    renderDialog();

    expect(screen.getByDisplayValue('Chi siamo')).toBeTruthy();
    expect(screen.getByDisplayValue('La nostra storia')).toBeTruthy();
    expect(
      screen.getByDisplayValue('https://example.com/chi-siamo'),
    ).toBeTruthy();
  });

  it('saves the edited title and description', async () => {
    vi.mocked(api.updateSeoMeta).mockResolvedValue(samplePage);

    renderDialog();
    fireEvent.change(screen.getByDisplayValue('Chi siamo'), {
      target: { value: 'Chi siamo - La nostra storia' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateSeoMeta).toHaveBeenCalledWith(
        'page-1',
        expect.objectContaining({ title: 'Chi siamo - La nostra storia' }),
      ),
    );
  });

  it('picks an OG image via the media picker and includes it in ogTags', async () => {
    const pick = vi.fn().mockResolvedValue({
      mediaId: 'media-1',
      url: 'http://localhost/uploads/a.webp',
    });
    vi.mocked(api.updateSeoMeta).mockResolvedValue(samplePage);

    renderDialog(pick);
    fireEvent.click(screen.getByRole('button', { name: /scegli immagine/i }));
    await waitFor(() => expect(pick).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateSeoMeta).toHaveBeenCalledWith(
        'page-1',
        expect.objectContaining({
          ogTags: { image: 'http://localhost/uploads/a.webp' },
        }),
      ),
    );
  });

  it('disables save when the title is blank', () => {
    renderDialog();

    fireEvent.change(screen.getByDisplayValue('Chi siamo'), {
      target: { value: '' },
    });

    const saveButton = screen.getByRole('button', {
      name: /^salva$/i,
    }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });
});
