import { createRef, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Block, BlockRect } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { createTestQueryClient } from '../../test-query-client.js';
import { BlockToolbarOverlay } from './block-toolbar-overlay.js';

// Nessun default risolto in questi test — non è il loro oggetto, e senza
// mock la query farebbe una vera fetch di rete (comportamento non
// deterministico). Vuoto = i campi mostrano il valore/placeholder com'era
// prima di docs/adr/0022's follow-up sul pre-fill.
vi.mock('../../lib/theme-api-client.js', () => ({
  fetchBlockStyleDefaults: vi.fn().mockResolvedValue({}),
  fetchThemeIcons: vi.fn().mockResolvedValue([]),
}));

function renderOverlay(ui: ReactElement) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      {ui}
    </QueryClientProvider>,
  );
}

const RECT: BlockRect = {
  id: 'block-1',
  top: 100,
  left: 50,
  width: 300,
  height: 40,
};

function buildIframeRef() {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  iframe.getBoundingClientRect = vi.fn(
    () => ({ top: 0, left: 0, width: 800, height: 600 }) as DOMRect,
  );
  const ref = createRef<HTMLIFrameElement>();
  ref.current = iframe;
  return ref;
}

const buttonDescriptor: BlockDescriptor = {
  type: 'Button',
  label: 'Bottone (CTA)',
  category: 'conversion',
  defaultProps: { label: 'Clicca qui' },
  fields: [],
  stylableProperties: ['backgroundColor', 'textColor', 'borderRadius'],
};

const heroDescriptor: BlockDescriptor = {
  type: 'Hero',
  label: 'Hero',
  category: 'content',
  defaultProps: { title: 'Titolo' },
  fields: [],
};

function baseProps() {
  return {
    iframeRef: buildIframeRef(),
    block: { id: 'block-1', type: 'Button', props: {} } as Block,
    descriptor: buttonDescriptor,
    rect: RECT,
    isRootLevel: true,
    canMoveUp: false,
    canMoveDown: false,
    registry: [buttonDescriptor],
    categories: [],
    onChangeProp: vi.fn(),
    onChangeInstanceStyle: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onInsertBefore: vi.fn(),
    onInsertAfter: vi.fn(),
  };
}

describe('BlockToolbarOverlay style buttons', () => {
  it('hides the type-level style button for a block with no stylableProperties', () => {
    renderOverlay(
      <BlockToolbarOverlay {...baseProps()} descriptor={heroDescriptor} />,
    );

    expect(
      screen.queryByRole('button', { name: /Stile di tutti i blocchi/ }),
    ).toBeNull();
  });

  it('still shows the instance style button for a root-level block with no stylableProperties (marginTop/marginBottom are always offered there)', () => {
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        descriptor={heroDescriptor}
        isRootLevel={true}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Stile di questo blocco' }),
    ).toBeTruthy();
  });

  it('hides the instance style button for a NESTED block with no stylableProperties (marginTop/marginBottom only apply to a page-root block)', () => {
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        descriptor={heroDescriptor}
        isRootLevel={false}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /Stile di questo blocco/ }),
    ).toBeNull();
  });

  it('shows the instance style button whenever the type has stylableProperties, regardless of typeStyle', () => {
    renderOverlay(<BlockToolbarOverlay {...baseProps()} />);

    expect(
      screen.getByRole('button', { name: 'Stile di questo blocco' }),
    ).toBeTruthy();
  });

  it('hides the type-level "Stile" button when typeStyle/onChangeTypeStyle are not provided (no site to save to yet)', () => {
    renderOverlay(<BlockToolbarOverlay {...baseProps()} />);

    expect(
      screen.queryByRole('button', { name: /Stile di tutti i blocchi/ }),
    ).toBeNull();
  });

  it('shows the type-level "Stile" button once typeStyle/onChangeTypeStyle are both provided', () => {
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        typeStyle={{}}
        onChangeTypeStyle={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Stile di tutti i blocchi Bottone (CTA)',
      }),
    ).toBeTruthy();
  });

  it('the instance popover is pre-filled from block.styleOverride and calls onChangeInstanceStyle on edit', () => {
    const onChangeInstanceStyle = vi.fn();
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        block={
          {
            id: 'block-1',
            type: 'Button',
            props: {},
            styleOverride: { borderRadius: '6px' },
          } as Block
        }
        onChangeInstanceStyle={onChangeInstanceStyle}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Stile di questo blocco' }),
    );
    expect(screen.getByLabelText('Raggio angoli')).toHaveProperty(
      'value',
      '6px',
    );

    fireEvent.change(screen.getByLabelText('Raggio angoli'), {
      target: { value: '9999px' },
    });

    expect(onChangeInstanceStyle).toHaveBeenCalledWith({
      borderRadius: '9999px',
    });
  });

  it('the type popover is pre-filled from typeStyle and calls onChangeTypeStyle on edit, never touching onChangeInstanceStyle', () => {
    const onChangeTypeStyle = vi.fn();
    const onChangeInstanceStyle = vi.fn();
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        typeStyle={{ borderRadius: '4px' }}
        onChangeTypeStyle={onChangeTypeStyle}
        onChangeInstanceStyle={onChangeInstanceStyle}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Stile di tutti i blocchi Bottone (CTA)',
      }),
    );
    expect(screen.getByLabelText('Raggio angoli')).toHaveProperty(
      'value',
      '4px',
    );

    fireEvent.change(screen.getByLabelText('Raggio angoli'), {
      target: { value: '9999px' },
    });

    expect(onChangeTypeStyle).toHaveBeenCalledWith({ borderRadius: '9999px' });
    expect(onChangeInstanceStyle).not.toHaveBeenCalled();
  });

  it('offers marginTop/marginBottom in the instance popover for a root-level block, and saves them via onChangeInstanceStyle', () => {
    const onChangeInstanceStyle = vi.fn();
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        isRootLevel={true}
        onChangeInstanceStyle={onChangeInstanceStyle}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Stile di questo blocco' }),
    );
    fireEvent.change(screen.getByLabelText('Spazio sotto'), {
      target: { value: '2rem' },
    });

    expect(onChangeInstanceStyle).toHaveBeenCalledWith({
      marginBottom: '2rem',
    });
  });

  it('does not offer marginTop/marginBottom in the instance popover for a NESTED block, even when the type has other stylableProperties', () => {
    renderOverlay(<BlockToolbarOverlay {...baseProps()} isRootLevel={false} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Stile di questo blocco' }),
    );

    expect(screen.queryByLabelText('Spazio sopra')).toBeNull();
    expect(screen.queryByLabelText('Spazio sotto')).toBeNull();
  });

  it('never offers marginTop/marginBottom in the type-level popover, even for a root-level block', () => {
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        isRootLevel={true}
        typeStyle={{}}
        onChangeTypeStyle={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Stile di tutti i blocchi Bottone (CTA)',
      }),
    );

    expect(screen.queryByLabelText('Spazio sopra')).toBeNull();
    expect(screen.queryByLabelText('Spazio sotto')).toBeNull();
  });
});

describe('BlockToolbarOverlay move buttons', () => {
  it('enables move up/down for a NESTED block when canMoveUp/canMoveDown are true (no longer gated by isRootLevel)', () => {
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        isRootLevel={false}
        canMoveUp={true}
        canMoveDown={true}
      />,
    );

    expect(
      screen
        .getByRole('button', { name: 'Sposta su' })
        .hasAttribute('disabled'),
    ).toBe(false);
    expect(
      screen
        .getByRole('button', { name: 'Sposta giù' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('disables move up/down when canMoveUp/canMoveDown are false, root-level or not', () => {
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        isRootLevel={true}
        canMoveUp={false}
        canMoveDown={false}
      />,
    );

    expect(
      screen
        .getByRole('button', { name: 'Sposta su' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Sposta giù' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it("calls onMoveUp/onMoveDown when a nested block's move buttons are clicked", () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        isRootLevel={false}
        canMoveUp={true}
        canMoveDown={true}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sposta su' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sposta giù' }));

    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });
});
