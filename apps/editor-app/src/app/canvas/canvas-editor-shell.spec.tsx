import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import type { Block } from '@brisk/shared-types';
import {
  PREVIEW_BRIDGE_SOURCE,
  PREVIEW_BRIDGE_VERSION,
} from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { TooltipProvider } from '../../components/ui/tooltip.js';
import { createTestQueryClient } from '../../test-query-client.js';
import * as blockFragmentApi from '../../lib/block-fragment-api-client.js';
import * as previewTokenApi from '../../lib/preview-token-api-client.js';
import { CanvasEditorShell } from './canvas-editor-shell.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../../lib/preview-token-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../lib/preview-token-api-client.js')
    >();
  return { ...actual, createPagePreviewToken: vi.fn() };
});

vi.mock('../../lib/block-fragment-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../lib/block-fragment-api-client.js')
    >();
  return { ...actual, renderBlockFragment: vi.fn() };
});

const heroDescriptor: BlockDescriptor = {
  type: 'Hero',
  label: 'Hero',
  category: 'content',
  defaultProps: { title: 'Titolo', subtitle: 'Sottotitolo' },
  fields: [
    { kind: 'text', key: 'title', label: 'Titolo', inlineEditable: true },
    { kind: 'text', key: 'subtitle', label: 'Sottotitolo' },
  ],
};
const textDescriptor: BlockDescriptor = {
  type: 'Text',
  label: 'Testo',
  category: 'content',
  defaultProps: { body: 'Corpo' },
  fields: [{ kind: 'text', key: 'body', label: 'Corpo', inlineEditable: true }],
};

const registry = [heroDescriptor, textDescriptor];
const categories = [{ title: 'Contenuto', types: ['Hero', 'Text'] }];

function renderShell(
  overrides: {
    blocks?: Block[];
    onChange?: (blocks: Block[]) => void;
    onPublish?: (blocks: Block[]) => unknown;
  } = {},
) {
  vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
  vi.mocked(previewTokenApi.createPagePreviewToken).mockResolvedValue({
    token: 'tok123',
    expiresAt: new Date().toISOString(),
  });

  const blocks: Block[] = overrides.blocks ?? [
    {
      id: 'hero-1',
      type: 'Hero',
      props: { title: 'Titolo', subtitle: 'Sottotitolo' },
    },
  ];
  const onChange = overrides.onChange ?? vi.fn();
  const onPublish = overrides.onPublish ?? vi.fn();
  const queryClient = createTestQueryClient();

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CanvasEditorShell
          backLink={<a href="/pages">Pagine</a>}
          statusText="Bozza salvata"
          registry={registry}
          categories={categories}
          blocks={blocks}
          onChange={onChange}
          onPublish={onPublish}
          pageId="page-1"
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );

  return { ...utils, onChange, onPublish, blocks };
}

async function getIframe() {
  return waitFor(
    () => screen.getByTitle('Anteprima pagina') as HTMLIFrameElement,
  );
}

function dispatchFromIframe(
  iframe: HTMLIFrameElement,
  type: string,
  payload: unknown,
) {
  const event = new MessageEvent('message', {
    data: {
      source: PREVIEW_BRIDGE_SOURCE,
      v: PREVIEW_BRIDGE_VERSION,
      type,
      payload,
    },
    origin: 'http://localhost:4321',
  });
  Object.defineProperty(event, 'source', { value: iframe.contentWindow });
  window.dispatchEvent(event);
}

/** La toolbar contestuale compare solo per un blocco di cui il bridge conosce già il rect — selezionarlo in un test richiede prima un `preview:ready`/`preview:block-rects` con quel rect, non solo il click. */
function selectBlockWithRect(
  iframe: HTMLIFrameElement,
  blockId: string,
  rect: { top: number; left: number; width: number; height: number },
) {
  act(() => {
    dispatchFromIframe(iframe, 'preview:ready', {
      blockRects: [{ id: blockId, ...rect }],
      scrollHeight: rect.top + rect.height,
    });
  });
  act(() => {
    dispatchFromIframe(iframe, 'preview:click', { blockId });
  });
}

const HERO_RECT = { top: 0, left: 0, width: 800, height: 100 };

function openPropertiesPopover() {
  fireEvent.click(screen.getByRole('button', { name: 'Modifica proprietà' }));
}

describe('CanvasEditorShell', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders the top bar (back link, status, publish, logout) and no toolbar when nothing is selected', async () => {
    renderShell();
    await getIframe();

    expect(screen.getByRole('link', { name: 'Pagine' })).toBeTruthy();
    expect(screen.getByText('Bozza salvata')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pubblica' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^esci$/i })).toBeTruthy();
    expect(screen.queryByTestId('block-breadcrumb')).toBeNull();
  });

  it('selecting a block on the canvas shows the contextual toolbar', async () => {
    renderShell();
    const iframe = await getIframe();

    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);

    expect(screen.getByTestId('block-breadcrumb').textContent).toBe('Hero');
    expect(screen.getByRole('button', { name: 'Rimuovi blocco' })).toBeTruthy();

    openPropertiesPopover();
    expect(screen.getByDisplayValue('Titolo')).toBeTruthy();
  });

  it('changing a property in the Inspector updates onChange after the debounce, and patches the fragment', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div>patched</div>',
    );
    const { onChange } = renderShell();
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    openPropertiesPopover();

    const input = screen.getByDisplayValue('Titolo');
    fireEvent.change(input, { target: { value: 'Nuovo titolo' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'hero-1',
        type: 'Hero',
        props: { title: 'Nuovo titolo', subtitle: 'Sottotitolo' },
      },
    ]);
    expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'hero-1',
        blockType: 'Hero',
        props: { title: 'Nuovo titolo', subtitle: 'Sottotitolo' },
      }),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'editor:patch-block' }),
        'http://localhost:4321',
      ),
    );
  });

  it('removing the selected block calls onChange with it gone', async () => {
    const { onChange } = renderShell();
    const iframe = await getIframe();

    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi blocco' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('inserting a block from the picker appends it at the root', async () => {
    const { onChange } = renderShell({ blocks: [] });
    await getIframe();

    fireEvent.click(screen.getByRole('button', { name: 'Testo' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'Text', props: { body: 'Corpo' } }),
    ]);
  });

  it('publish sends the current local block tree', async () => {
    const { onPublish, blocks } = renderShell();
    await getIframe();

    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }));

    expect(onPublish).toHaveBeenCalledWith(blocks);
  });

  it('double-clicking an inlineEditable field enters text edit on the iframe', async () => {
    renderShell();
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    act(() => {
      dispatchFromIframe(iframe, 'preview:dblclick', {
        blockId: 'hero-1',
        field: 'title',
      });
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:enter-text-edit',
        payload: { blockId: 'hero-1', field: 'title' },
      },
      'http://localhost:4321',
    );
  });

  it('double-clicking a field that is not inlineEditable does nothing', async () => {
    renderShell();
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    act(() => {
      dispatchFromIframe(iframe, 'preview:dblclick', {
        blockId: 'hero-1',
        field: 'subtitle',
      });
    });

    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'editor:enter-text-edit' }),
      expect.anything(),
    );
  });

  it('typing live in TipTap updates the tree optically and saves after its own debounce', async () => {
    const { onChange } = renderShell();
    const iframe = await getIframe();

    act(() => {
      dispatchFromIframe(iframe, 'preview:text-changed', {
        blockId: 'hero-1',
        field: 'title',
        text: 'Digitato dal vivo',
      });
    });

    // Aggiornamento ottico immediato, prima del debounce di salvataggio.
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    openPropertiesPopover();
    expect(screen.getByDisplayValue('Digitato dal vivo')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'hero-1',
        type: 'Hero',
        props: { title: 'Digitato dal vivo', subtitle: 'Sottotitolo' },
      },
    ]);
  });

  it('dragging a block past another on the canvas reorders the root blocks', async () => {
    const { onChange } = renderShell({
      blocks: [
        {
          id: 'hero-1',
          type: 'Hero',
          props: { title: 'Titolo', subtitle: 'Sottotitolo' },
        },
        { id: 'text-1', type: 'Text', props: { body: 'Corpo' } },
      ],
    });
    const iframe = await getIframe();

    act(() => {
      dispatchFromIframe(iframe, 'preview:ready', {
        blockRects: [
          { id: 'hero-1', top: 0, left: 0, width: 800, height: 100 },
          { id: 'text-1', top: 100, left: 0, width: 800, height: 100 },
        ],
        scrollHeight: 200,
      });
    });

    // Trascina hero-1 (in alto) oltre il punto medio di text-1 (150) — deve
    // finire dopo di esso.
    act(() => {
      dispatchFromIframe(iframe, 'preview:drag-start', {
        blockId: 'hero-1',
        pointer: { x: 10, y: 10 },
      });
    });
    expect(screen.queryByTestId('drop-indicator')).toBeTruthy();

    act(() => {
      dispatchFromIframe(iframe, 'preview:drag-move', {
        pointer: { x: 10, y: 180 },
      });
    });
    act(() => {
      dispatchFromIframe(iframe, 'preview:drag-end', {});
    });

    expect(onChange).toHaveBeenCalledWith([
      { id: 'text-1', type: 'Text', props: { body: 'Corpo' } },
      {
        id: 'hero-1',
        type: 'Hero',
        props: { title: 'Titolo', subtitle: 'Sottotitolo' },
      },
    ]);
    expect(screen.queryByTestId('drop-indicator')).toBeNull();
  });

  it('dragging without crossing any midpoint leaves the root order unchanged (no spurious onChange)', async () => {
    const { onChange } = renderShell({
      blocks: [
        {
          id: 'hero-1',
          type: 'Hero',
          props: { title: 'Titolo', subtitle: 'Sottotitolo' },
        },
        { id: 'text-1', type: 'Text', props: { body: 'Corpo' } },
      ],
    });
    const iframe = await getIframe();

    act(() => {
      dispatchFromIframe(iframe, 'preview:ready', {
        blockRects: [
          { id: 'hero-1', top: 0, left: 0, width: 800, height: 100 },
          { id: 'text-1', top: 100, left: 0, width: 800, height: 100 },
        ],
        scrollHeight: 200,
      });
    });

    act(() => {
      dispatchFromIframe(iframe, 'preview:drag-start', {
        blockId: 'hero-1',
        pointer: { x: 10, y: 10 },
      });
    });
    act(() => {
      dispatchFromIframe(iframe, 'preview:drag-end', {});
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('pressing Escape exits text edit on the iframe', async () => {
    renderShell();
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:exit-text-edit',
        payload: {},
      },
      'http://localhost:4321',
    );
  });
});
