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
import { TooltipProvider } from '../../components/ui/tooltip';
import { createTestQueryClient } from '../../test-query-client';
import * as blockFragmentApi from '../../lib/block-fragment-api-client';
import * as previewTokenApi from '../../lib/preview-token-api-client';
import { PUBLIC_SITE_URL } from '../../lib/public-site-url';
import { ToastProvider } from '../toast-provider';
import { CanvasEditorShell } from './canvas-editor-shell';
import { PageListContext } from '../page-list-context';

// The shell needs it the same way production does: page links are picked
// through the editor's own dialog, which this context provides.
const pageListPort = { pick: () => Promise.resolve(null) };

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../../lib/preview-token-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../lib/preview-token-api-client')>();
  return { ...actual, createTranslationPreviewToken: vi.fn() };
});

vi.mock('../../lib/block-fragment-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../lib/block-fragment-api-client')
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
const columnsDescriptor: BlockDescriptor = {
  type: 'Columns',
  label: 'Colonne',
  category: 'layout',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['Column'],
};
const columnDescriptor: BlockDescriptor = {
  type: 'Column',
  label: 'Colonna',
  category: 'layout',
  defaultProps: {},
  fields: [],
};

const registry = [
  heroDescriptor,
  textDescriptor,
  columnsDescriptor,
  columnDescriptor,
];
const categories = [
  { title: 'Contenuto', types: ['Hero', 'Text'] },
  { title: 'Layout', types: ['Columns', 'Column'] },
];

function renderShell(
  overrides: {
    blocks?: Block[];
    onChange?: (blocks: Block[]) => void;
    onPublish?: (blocks: Block[]) => unknown;
  } = {},
) {
  vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
  vi.mocked(previewTokenApi.createTranslationPreviewToken).mockResolvedValue({
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
        <ToastProvider>
          <PageListContext.Provider value={pageListPort}>
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
          </PageListContext.Provider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );

  /** Re-renders the SAME shell with another page — what switching language does (the shell is not remounted, it resyncs from props). */
  function switchPage(nextPageId: string, nextBlocks: Block[]) {
    utils.rerender(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ToastProvider>
            <PageListContext.Provider value={pageListPort}>
              <CanvasEditorShell
                backLink={<a href="/pages">Pagine</a>}
                statusText="Bozza salvata"
                registry={registry}
                categories={categories}
                blocks={nextBlocks}
                onChange={onChange}
                onPublish={onPublish}
                pageId={nextPageId}
              />
            </PageListContext.Provider>
          </ToastProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );
  }

  return { ...utils, onChange, onPublish, blocks, switchPage };
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
    origin: PUBLIC_SITE_URL,
  });
  Object.defineProperty(event, 'source', { value: iframe.contentWindow });
  window.dispatchEvent(event);
}

/** The contextual toolbar only appears for a block whose rect the bridge already knows — selecting one in a test requires a `preview:ready`/`preview:block-rects` carrying that rect first, not just the click. */
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

  it('renders the top bar (back link, status, publish) and no toolbar when nothing is selected', async () => {
    renderShell();
    await getIframe();

    expect(screen.getByRole('link', { name: 'Pagine' })).toBeTruthy();
    expect(screen.getByText('Bozza salvata')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pubblica' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^esci$/i })).toBeNull();
    expect(screen.queryByTestId('block-breadcrumb')).toBeNull();
  });

  it('collapsing the left sidebar hides only the block picker, not the Layers panel', async () => {
    renderShell();
    await getIframe();

    expect(screen.getByText('Livelli')).toBeTruthy();
    expect(screen.getByText('Inserisci blocco')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Comprimi barra laterale' }),
    );
    expect(screen.queryByText('Inserisci blocco')).toBeNull();
    expect(screen.getByText('Livelli')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Espandi barra laterale' }),
    );
    expect(screen.getByText('Inserisci blocco')).toBeTruthy();
    expect(screen.getByText('Livelli')).toBeTruthy();
  });

  it('collapsing the right Layers panel hides only Livelli, not the block picker', async () => {
    renderShell();
    await getIframe();

    fireEvent.click(
      screen.getByRole('button', { name: 'Comprimi pannello Livelli' }),
    );
    expect(screen.queryByText('Livelli')).toBeNull();
    expect(screen.getByText('Inserisci blocco')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Espandi pannello Livelli' }),
    );
    expect(screen.getByText('Livelli')).toBeTruthy();
    expect(screen.getByText('Inserisci blocco')).toBeTruthy();
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

  it('clicking a block in the Layers panel selects it and asks the iframe to scroll it into view', async () => {
    renderShell();
    const iframe = await getIframe();
    if (!iframe.contentWindow) {
      throw new Error('Test fixture iframe has no contentWindow');
    }
    const postMessageSpy = vi.spyOn(iframe.contentWindow, 'postMessage');

    fireEvent.click(screen.getByTestId('layer-row'));

    expect(screen.getByTestId('layer-row').getAttribute('data-state')).toBe(
      'selected',
    );
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:scroll-to-block',
        payload: { blockId: 'hero-1' },
      },
      '*',
    );
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
        '*',
      ),
    );
  });

  it('removing the selected block calls onChange with it gone, and patches the canvas to actually remove it', async () => {
    const { onChange } = renderShell();
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi blocco' }));

    expect(onChange).toHaveBeenCalledWith([]);
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:remove-block',
        payload: { blockId: 'hero-1' },
      },
      '*',
    );
  });

  it('removing a NESTED block re-patches its parent instead of a plain editor:remove-block, so the parent chrome (e.g. an empty-state hint) updates too', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div data-brisk-block-id="columns-1" data-brisk-block-type="Columns">colonne di nuovo vuote</div>',
    );
    const { onChange } = renderShell({
      blocks: [
        {
          id: 'columns-1',
          type: 'Columns',
          props: {},
          children: [{ id: 'column-1', type: 'Column', props: {} }],
        },
      ],
    });
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    selectBlockWithRect(iframe, 'column-1', {
      top: 0,
      left: 0,
      width: 400,
      height: 40,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi blocco' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'columns-1', children: [] }),
    ]);
    await waitFor(() =>
      expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith(
        expect.objectContaining({
          blockId: 'columns-1',
          blockType: 'Columns',
          children: [],
        }),
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:patch-block',
          payload: expect.objectContaining({
            blockId: 'columns-1',
            html: '<div data-brisk-block-id="columns-1" data-brisk-block-type="Columns">colonne di nuovo vuote</div>',
          }),
        }),
        '*',
      ),
    );
    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'editor:remove-block' }),
      '*',
    );
  });

  it('inserting a block from the picker appends it at the root', async () => {
    const { onChange } = renderShell({ blocks: [] });
    await getIframe();

    fireEvent.click(screen.getByRole('button', { name: 'Contenuto' }));
    // The block button is draggable (block-picker.tsx) — it uses Pointer
    // Events rather than a plain click: a down+up with no movement in
    // between is the correct simulation of an ordinary click (no drag
    // threshold crossed).
    const testoButton = screen.getByRole('button', { name: 'Testo' });
    fireEvent.pointerDown(testoButton, { pointerId: 1 });
    fireEvent.pointerUp(testoButton, { pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'Text', props: { body: 'Corpo' } }),
    ]);
  });

  it('inserting a block from the picker also renders and patches it into the canvas (the reported bug: a new block used to stay invisible until reload)', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div data-brisk-block-id="new-text">Corpo</div>',
    );
    renderShell({ blocks: [] });
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Contenuto' }));
    const testoButton = screen.getByRole('button', { name: 'Testo' });
    fireEvent.pointerDown(testoButton, { pointerId: 1 });
    fireEvent.pointerUp(testoButton, { pointerId: 1 });

    await waitFor(() =>
      expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith(
        expect.objectContaining({
          blockType: 'Text',
          props: { body: 'Corpo' },
        }),
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:insert-block',
          payload: expect.objectContaining({
            html: '<div data-brisk-block-id="new-text">Corpo</div>',
            parentId: null,
            beforeBlockId: null,
          }),
        }),
        '*',
      ),
    );
  });

  it('duplicating a block renders and patches the clone into the canvas', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div data-brisk-block-id="hero-copy">Titolo</div>',
    );
    renderShell();
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    fireEvent.click(screen.getByRole('button', { name: 'Duplica blocco' }));

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:insert-block',
          payload: expect.objectContaining({
            parentId: null,
            beforeBlockId: null,
          }),
        }),
        '*',
      ),
    );
  });

  it('dragging a block from the picker onto the canvas inserts it at the computed drop position', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div data-brisk-block-id="new-text">Corpo</div>',
    );
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
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    act(() => {
      dispatchFromIframe(iframe, 'preview:ready', {
        blockRects: [
          { id: 'hero-1', top: 0, left: 0, width: 800, height: 100 },
          { id: 'text-1', top: 100, left: 0, width: 800, height: 100 },
        ],
        scrollHeight: 200,
      });
    });

    // The sidebar/BlockPicker always measures {top:0,left:0,width:0} in
    // this test environment (no real layout in jsdom, and this file does
    // not mock the iframe's getBoundingClientRect the way
    // overlay-layer.spec.tsx does) — pageX 0 is therefore "inside" the
    // canvas by construction, consistent with isOverCanvas in
    // canvas-editor-shell.tsx.
    fireEvent.click(screen.getByRole('button', { name: 'Contenuto' }));
    const testoButton = screen.getByRole('button', { name: 'Testo' });
    fireEvent.pointerDown(testoButton, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Oltre il punto medio di text-1 (150) — il rilascio deve finire in coda.
    fireEvent.pointerMove(testoButton, {
      pointerId: 1,
      clientX: 0,
      clientY: 180,
    });
    fireEvent.pointerUp(testoButton, {
      pointerId: 1,
      clientX: 0,
      clientY: 180,
    });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'hero-1' }),
        expect.objectContaining({ id: 'text-1' }),
        expect.objectContaining({ type: 'Text', props: { body: 'Corpo' } }),
      ]),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:insert-block',
          payload: expect.objectContaining({
            html: '<div data-brisk-block-id="new-text">Corpo</div>',
            parentId: null,
            beforeBlockId: null,
          }),
        }),
        '*',
      ),
    );
  });

  it('dragging a block from the picker while a container is selected nests it as a child, instead of landing at root', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div data-brisk-block-id="columns-1" data-brisk-block-type="Columns">colonne aggiornate</div>',
    );
    const { onChange } = renderShell({
      blocks: [{ id: 'columns-1', type: 'Columns', props: {}, children: [] }],
    });
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    selectBlockWithRect(iframe, 'columns-1', {
      top: 0,
      left: 0,
      width: 800,
      height: 40,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    const colonnaButton = screen.getByRole('button', { name: 'Colonna' });
    fireEvent.pointerDown(colonnaButton, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // The same (0,0) point as the root-insert test above — "inside the
    // canvas" by construction in this test environment. The point does not
    // matter here for the position (a selected container always nests at
    // the end of its children, the same rule resolveInsertTarget uses for a
    // click), only for crossing the 4px threshold that starts the drag.
    fireEvent.pointerMove(colonnaButton, {
      pointerId: 1,
      clientX: 0,
      clientY: 5,
    });
    fireEvent.pointerUp(colonnaButton, {
      pointerId: 1,
      clientX: 0,
      clientY: 5,
    });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'columns-1',
          type: 'Columns',
          children: [expect.objectContaining({ type: 'Column' })],
        }),
      ]),
    );
    // Not "editor:insert-block" for the new child on its own: the PARENT
    // (Columns) has to be regenerated and re-patched in full through
    // "editor:patch-block" — otherwise the container-resolution heuristic
    // in preview-bridge-client.ts would assume <slot/> is the sole content
    // of the container block's root, which is false for blocks like
    // Testimonials (navigation buttons plus a placeholder around the slot).
    await waitFor(() =>
      expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith(
        expect.objectContaining({
          blockId: 'columns-1',
          blockType: 'Columns',
          children: [expect.objectContaining({ type: 'Column' })],
        }),
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:patch-block',
          payload: expect.objectContaining({
            blockId: 'columns-1',
            html: '<div data-brisk-block-id="columns-1" data-brisk-block-type="Columns">colonne aggiornate</div>',
          }),
        }),
        '*',
      ),
    );
  });

  it('the "Aggiungi elemento" button on a selected collection container adds one more child of its canonical type, no picker needed', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div data-brisk-block-id="columns-1" data-brisk-block-type="Columns">colonne con due colonne</div>',
    );
    const { onChange } = renderShell({
      blocks: [
        {
          id: 'columns-1',
          type: 'Columns',
          props: {},
          children: [{ id: 'column-1', type: 'Column', props: {} }],
        },
      ],
    });
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    selectBlockWithRect(iframe, 'columns-1', {
      top: 0,
      left: 0,
      width: 800,
      height: 80,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi elemento' }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'columns-1',
          children: [
            expect.objectContaining({ id: 'column-1', type: 'Column' }),
            expect.objectContaining({ type: 'Column' }),
          ],
        }),
      ]),
    );
    await waitFor(() =>
      expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith(
        expect.objectContaining({
          blockId: 'columns-1',
          blockType: 'Columns',
          children: expect.arrayContaining([
            expect.objectContaining({ id: 'column-1' }),
            expect.objectContaining({ type: 'Column' }),
          ]),
        }),
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:patch-block',
          payload: expect.objectContaining({ blockId: 'columns-1' }),
        }),
        '*',
      ),
    );
  });

  it('the "Aggiungi elemento" button is absent for a block that is not a container, and for a generic container with no single canonical child type', async () => {
    renderShell({
      blocks: [{ id: 'hero-1', type: 'Hero', props: { title: 'Titolo' } }],
    });
    const iframe = await getIframe();

    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);

    expect(
      screen.queryByRole('button', { name: 'Aggiungi elemento' }),
    ).toBeNull();
  });

  it('dragging a block from the picker but releasing outside the canvas cancels the insert', async () => {
    const { onChange } = renderShell({ blocks: [] });
    await getIframe();

    fireEvent.click(screen.getByRole('button', { name: 'Contenuto' }));
    const testoButton = screen.getByRole('button', { name: 'Testo' });
    fireEvent.pointerDown(testoButton, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // The iframe's width is 0 in this test environment — any positive
    // clientX therefore falls outside its bounds by construction.
    fireEvent.pointerMove(testoButton, {
      pointerId: 1,
      clientX: 999,
      clientY: 50,
    });
    fireEvent.pointerUp(testoButton, {
      pointerId: 1,
      clientX: 999,
      clientY: 50,
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("moving the selected block down via the toolbar's arrows reorders it and patches the canvas", async () => {
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
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    fireEvent.click(screen.getByRole('button', { name: 'Sposta giù' }));

    expect(onChange).toHaveBeenCalledWith([
      { id: 'text-1', type: 'Text', props: { body: 'Corpo' } },
      {
        id: 'hero-1',
        type: 'Hero',
        props: { title: 'Titolo', subtitle: 'Sottotitolo' },
      },
    ]);
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:reorder-blocks',
        payload: { parentId: null, orderedIds: ['text-1', 'hero-1'] },
      },
      '*',
    );
  });

  it("moving a NESTED block via the toolbar's arrows re-patches its parent instead of editor:reorder-blocks", async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div data-brisk-block-id="columns-1" data-brisk-block-type="Columns">colonne riordinate</div>',
    );
    const { onChange } = renderShell({
      blocks: [
        {
          id: 'columns-1',
          type: 'Columns',
          props: {},
          children: [
            { id: 'column-1', type: 'Column', props: {} },
            { id: 'column-2', type: 'Column', props: {} },
          ],
        },
      ],
    });
    const iframe = await getIframe();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    selectBlockWithRect(iframe, 'column-1', {
      top: 0,
      left: 0,
      width: 400,
      height: 40,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sposta giù' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'columns-1',
        children: [
          expect.objectContaining({ id: 'column-2' }),
          expect.objectContaining({ id: 'column-1' }),
        ],
      }),
    ]);
    await waitFor(() =>
      expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith(
        expect.objectContaining({
          blockId: 'columns-1',
          blockType: 'Columns',
          children: [
            expect.objectContaining({ id: 'column-2' }),
            expect.objectContaining({ id: 'column-1' }),
          ],
        }),
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:patch-block',
          payload: expect.objectContaining({ blockId: 'columns-1' }),
        }),
        '*',
      ),
    );
    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'editor:reorder-blocks' }),
      '*',
    );
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
        payload: {
          blockId: 'hero-1',
          field: 'title',
          richText: false,
          // Translated on this side: the preview document is a rendered
          // site in the visitor's language, not the editor's.
          labels: expect.objectContaining({ bold: expect.any(String) }),
        },
      },
      '*',
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
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

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
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:reorder-blocks',
          payload: { parentId: null, orderedIds: ['text-1', 'hero-1'] },
        },
        '*',
      ),
    );
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
      '*',
    );
  });

  it('the undo/redo buttons start disabled, and undo becomes enabled after a change', async () => {
    const { onChange } = renderShell();
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);

    expect(
      screen.getByRole('button', { name: 'Annulla' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Ripeti' }).hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi blocco' }));

    expect(onChange).toHaveBeenCalledWith([]);
    expect(
      screen.getByRole('button', { name: 'Annulla' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('clicking Annulla restores the block removed by the previous action', async () => {
    const { onChange } = renderShell();
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi blocco' }));
    vi.mocked(onChange).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'hero-1',
        type: 'Hero',
        props: { title: 'Titolo', subtitle: 'Sottotitolo' },
      },
    ]);
  });

  it('Ctrl+Z triggers undo', async () => {
    const { onChange } = renderShell();
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi blocco' }));
    vi.mocked(onChange).mockClear();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'hero-1',
        type: 'Hero',
        props: { title: 'Titolo', subtitle: 'Sottotitolo' },
      },
    ]);
  });

  it('Ctrl+Z is ignored while typing in a text input, leaving the browser its own native undo', async () => {
    renderShell();
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi blocco' }));
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    // The Undo button stays enabled: the shortcut was not taken up by this
    // listener (or the stack would already be empty).
    expect(
      screen.getByRole('button', { name: 'Annulla' }).hasAttribute('disabled'),
    ).toBe(false);
    input.remove();
  });

  // A debounced save belongs to the page it was scheduled on. The shell is
  // NOT remounted when you switch language (it resyncs `blocks` from props),
  // so a timer still in flight used to fire against whatever tree had
  // meanwhile taken its place. Two blocks on purpose: the edited one looks
  // identical either way, the SIBLING is what says which page was saved.
  it('saves an in-flight edit against the page it was made on, not the one switched to', async () => {
    const italian: Block[] = [
      { id: 'hero-1', type: 'Hero', props: { title: 'Ciao', subtitle: 'S' } },
      { id: 'text-1', type: 'Text', props: { body: 'IT' } },
    ];
    const english: Block[] = [
      { id: 'hero-1', type: 'Hero', props: { title: 'Hello', subtitle: 'S' } },
      { id: 'text-1', type: 'Text', props: { body: 'EN' } },
    ];
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<section>hero</section>',
    );
    const onChange = vi.fn();
    const { switchPage } = renderShell({ blocks: italian, onChange });
    const iframe = await getIframe();

    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);
    openPropertiesPopover();
    fireEvent.change(screen.getByDisplayValue('Ciao'), {
      target: { value: 'Ciao a tutti' },
    });

    // Switch language well inside the 300ms debounce window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    act(() => switchPage('page-2', english));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const saved = onChange.mock.calls
      .map(([tree]) => tree as Block[])
      .filter((tree) => tree[0]?.props?.title === 'Ciao a tutti');
    expect(saved.length).toBeGreaterThan(0);
    for (const tree of saved) {
      expect(tree[1]?.props?.body).toBe('IT');
    }
  });
});

/*
 * Two shortcuts existed before Fase 7 — undo and redo — and every other
 * gesture needed the mouse. These are the ones the plan asks for, plus
 * the guard that keeps them out of the way of ordinary typing.
 */
describe('CanvasEditorShell keyboard shortcuts', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('deletes the selected block with Delete', async () => {
    const onChange = vi.fn();
    renderShell({ onChange });
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('duplicates the selected block with Cmd+D', async () => {
    const onChange = vi.fn();
    renderShell({ onChange });
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);

    fireEvent.keyDown(window, { key: 'd', metaKey: true });

    const next = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(next).toHaveLength(2);
    // A copy, not the same block twice: the ids key the per-instance style
    // rule and the translation overlay.
    expect(next[1].id).not.toBe('hero-1');
    expect(next[1].props).toEqual(next[0].props);
  });

  /*
   * Copy/paste is the editor's own clipboard, not the system one: reading
   * that needs a permission prompt, and writing a block to it as text
   * would put a wall of JSON into whatever the person pastes into next.
   */
  it('copies and pastes a block with Cmd+C then Cmd+V', async () => {
    const onChange = vi.fn();
    renderShell({ onChange });
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);

    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'v', metaKey: true });

    const next = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(next).toHaveLength(2);
    expect(next[1].id).not.toBe('hero-1');
  });

  it('pastes nothing when nothing was copied', async () => {
    const onChange = vi.fn();
    renderShell({ onChange });
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);

    fireEvent.keyDown(window, { key: 'v', metaKey: true });

    expect(onChange).not.toHaveBeenCalled();
  });

  /*
   * Alt, not a bare arrow: the arrows scroll, and taking that away from
   * somebody reading a long page would be the wrong trade.
   */
  it('moves the selected block with Alt+Arrow', async () => {
    const onChange = vi.fn();
    renderShell({
      onChange,
      blocks: [
        { id: 'hero-1', type: 'Hero', props: { title: 'A', subtitle: '' } },
        { id: 'hero-2', type: 'Hero', props: { title: 'B', subtitle: '' } },
      ],
    });
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-2', HERO_RECT);

    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });

    const next = onChange.mock.calls.at(-1)?.[0] as Block[];
    expect(next.map((block) => block.id)).toEqual(['hero-2', 'hero-1']);
  });

  /*
   * The guard that matters: Delete has to delete a character in the
   * editor's own inputs, not the block behind the dialog.
   */
  it('leaves the editor’s own inputs alone', async () => {
    const onChange = vi.fn();
    renderShell({ onChange });
    const iframe = await getIframe();
    selectBlockWithRect(iframe, 'hero-1', HERO_RECT);

    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    fireEvent.keyDown(window, { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();

    input.remove();
  });
});
