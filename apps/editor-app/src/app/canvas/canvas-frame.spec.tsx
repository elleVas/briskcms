import { render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as previewTokenApi from '../../lib/preview-token-api-client.js';
import { buildPreviewUrl, CanvasFrame } from './canvas-frame.js';
import type { PreviewBridgeState } from './use-preview-bridge.js';

vi.mock('../../lib/preview-token-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../lib/preview-token-api-client.js')
    >();
  return { ...actual, createPagePreviewToken: vi.fn() };
});

const emptyBridge: PreviewBridgeState = {
  blockRects: [],
  isReady: false,
  hoveredBlockId: null,
  selectedBlockId: null,
  lastDblClick: null,
  lastTextChange: null,
  activeDrag: null,
  dragEnded: null,
  patchBlock: vi.fn(),
  insertBlock: vi.fn(),
  removeBlock: vi.fn(),
  reorderBlocks: vi.fn(),
  enterTextEdit: vi.fn(),
  exitTextEdit: vi.fn(),
  selectBlock: vi.fn(),
  updateBlockStyleCss: vi.fn(),
};

describe('buildPreviewUrl', () => {
  it('builds a plain page preview URL with just the token', () => {
    const url = buildPreviewUrl('page-1', 'tok123');
    expect(url).toBe('http://localhost:4321/preview/page-1?token=tok123');
  });

  it('adds editingSection when editing header/footer', () => {
    const url = buildPreviewUrl('page-1', 'tok123', 'header');
    expect(url).toBe(
      'http://localhost:4321/preview/page-1?token=tok123&editingSection=header',
    );
  });
});

describe('CanvasFrame', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderFrame(props: Partial<Parameters<typeof CanvasFrame>[0]> = {}) {
    const iframeRef = createRef<HTMLIFrameElement>();
    return render(
      <CanvasFrame
        pageId="page-1"
        iframeRef={iframeRef}
        bridge={emptyBridge}
        {...props}
      />,
    );
  }

  it('creates a preview token and loads the iframe at the resulting URL', async () => {
    vi.mocked(previewTokenApi.createPagePreviewToken).mockResolvedValue({
      token: 'tok123',
      expiresAt: new Date().toISOString(),
    });

    renderFrame();

    await waitFor(() =>
      expect(screen.getByTitle('Anteprima pagina').getAttribute('src')).toBe(
        'http://localhost:4321/preview/page-1?token=tok123',
      ),
    );
    expect(previewTokenApi.createPagePreviewToken).toHaveBeenCalledWith(
      'page-1',
    );
  });

  it('passes editingSection through to the iframe URL', async () => {
    vi.mocked(previewTokenApi.createPagePreviewToken).mockResolvedValue({
      token: 'tok123',
      expiresAt: new Date().toISOString(),
    });

    renderFrame({ editingSection: 'footer' });

    await waitFor(() =>
      expect(screen.getByTitle('Anteprima pagina').getAttribute('src')).toBe(
        'http://localhost:4321/preview/page-1?token=tok123&editingSection=footer',
      ),
    );
  });

  it('shows an error instead of a stuck blank iframe when the token request fails', async () => {
    vi.mocked(previewTokenApi.createPagePreviewToken).mockRejectedValue(
      new Error('boom'),
    );

    renderFrame();

    await waitFor(() =>
      expect(
        screen.getByText("Impossibile caricare l'anteprima. Riprova."),
      ).not.toBeNull(),
    );
    expect(screen.queryByTitle('Anteprima pagina')).toBeNull();
  });

  it('defaults to full width when no breakpoint is given', async () => {
    vi.mocked(previewTokenApi.createPagePreviewToken).mockResolvedValue({
      token: 'tok123',
      expiresAt: new Date().toISOString(),
    });

    renderFrame();

    const iframe = await waitFor(() => screen.getByTitle('Anteprima pagina'));
    expect((iframe.parentElement as HTMLElement).style.width).toBe('100%');
  });

  it('constrains the iframe to a fixed width for the tablet breakpoint', async () => {
    vi.mocked(previewTokenApi.createPagePreviewToken).mockResolvedValue({
      token: 'tok123',
      expiresAt: new Date().toISOString(),
    });

    renderFrame({ breakpoint: 'tablet' });

    const iframe = await waitFor(() => screen.getByTitle('Anteprima pagina'));
    expect((iframe.parentElement as HTMLElement).style.width).toBe('768px');
  });

  it('constrains the iframe to a fixed width for the mobile breakpoint', async () => {
    vi.mocked(previewTokenApi.createPagePreviewToken).mockResolvedValue({
      token: 'tok123',
      expiresAt: new Date().toISOString(),
    });

    renderFrame({ breakpoint: 'mobile' });

    const iframe = await waitFor(() => screen.getByTitle('Anteprima pagina'));
    expect((iframe.parentElement as HTMLElement).style.width).toBe('375px');
  });
});
