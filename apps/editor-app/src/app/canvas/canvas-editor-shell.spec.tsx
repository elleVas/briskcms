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
import { PUBLIC_SITE_URL } from '../../lib/public-site-url.js';
import { ToastProvider } from '../toast-provider.js';
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
        <ToastProvider>
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
        </ToastProvider>
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
    origin: PUBLIC_SITE_URL,
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
    // Il bottone-blocco è trascinabile (block-picker.tsx) — usa Pointer
    // Events, non un semplice click: un down+up senza movimento in mezzo è
    // la simulazione corretta di un click normale (nessuna soglia di drag
    // superata).
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

    // La sidebar/BlockPicker misura sempre {top:0,left:0,width:0} in questo
    // ambiente di test (nessun layout reale in jsdom, e questo file non
    // mocka getBoundingClientRect dell'iframe come fa invece
    // overlay-layer.spec.tsx) — pageX 0 è quindi "dentro" al canvas per
    // costruzione, coerente con isOverCanvas in canvas-editor-shell.tsx.
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
    // Stesso punto (0,0) del test di inserimento a radice sopra — "dentro
    // al canvas" per costruzione in questo ambiente di test. Il punto qui
    // non conta per la posizione (un contenitore selezionato annida sempre
    // in coda ai suoi figli, stessa regola di resolveInsertTarget per il
    // click), solo per superare la soglia di 4px che avvia il drag.
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
    // Non "editor:insert-block" per il nuovo figlio da solo: il GENITORE
    // (Columns) va rigenerato e ripatchato per intero via "editor:patch-block"
    // — l'euristica di risoluzione del contenitore in preview-bridge-client.ts
    // assumerebbe altrimenti che <slot/> sia l'unico contenuto della radice
    // del blocco-contenitore, falsa per blocchi come Testimonials (pulsanti
    // di navigazione + segnaposto attorno allo slot).
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
    // width dell'iframe è 0 in questo ambiente di test — qualunque clientX
    // positivo cade quindi fuori dai suoi confini per costruzione.
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
        payload: { blockId: 'hero-1', field: 'title' },
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

    // Il bottone Annulla resta abilitato: la scorciatoia non è stata presa
    // in carico da questo listener (altrimenti lo stack sarebbe già vuoto).
    expect(
      screen.getByRole('button', { name: 'Annulla' }).hasAttribute('disabled'),
    ).toBe(false);
    input.remove();
  });
});
