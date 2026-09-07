import { createRef, type ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  DEFAULT_COOKIE_BANNER_SETTINGS,
  type Block,
  type BlockRect,
  type SiteRecord,
} from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { createTestQueryClient } from '../../test-query-client';
import * as siteApi from '../../lib/sites-api-client';
import * as themeApi from '../../lib/theme-api-client';
import { BlockToolbarOverlay } from './block-toolbar-overlay';

// No resolved defaults in these tests — they are not what these tests are
// about, and without a mock the query would make a real network fetch
// (non-deterministic behaviour). Empty = the fields show the
// value/placeholder as it was before docs/adr/0022's pre-fill follow-up.
// `useActiveThemeName` reads the site, and every theme-* query stays
// disabled while it is empty — so without this the capabilities query
// never runs and the toolbar falls back to "allowed", which is the very
// behaviour the last two tests here are checking.
vi.mock('../../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../lib/sites-api-client')>();
  return { ...actual, getCurrentSite: vi.fn() };
});

vi.mock('../../lib/theme-api-client', () => ({
  fetchBlockStyleDefaults: vi.fn().mockResolvedValue({}),
  fetchThemeIcons: vi.fn().mockResolvedValue([]),
  fetchThemeCapabilities: vi.fn().mockResolvedValue({
    allowStyleOverrides: true,
  }),
}));

/** Only what `useActiveThemeName` reads — the rest of the record is beside the point here. */
function buildSiteStub(themeName: string): SiteRecord {
  return {
    id: 'site-1',
    tenantId: 'tenant-1',
    name: 'Sito',
    domain: null,
    themeName,
    defaultLocale: 'it',
    enabledLocales: ['it'],
    untranslatedPageFallback: 'redirect-to-default',
    businessAddress: null,
    businessPhone: null,
    businessType: null,
    openingHours: null,
    searchEngineIndexingEnabled: false,
    themePrimaryColor: null,
    themeSecondaryColor: null,
    themeFontFamily: null,
    themeCustomCss: null,
    themeHeadScript: null,
    themeBodyScript: null,
    themeFaviconUrl: null,
    themeOverridesEnabled: true,
    themeAllowedTrackerDomains: [],
    formSubmissionRetentionDays: null,
    themeTrackerScripts: [],
    cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
    themeTokens: { blockStyles: {} },
    createdAt: '',
  };
}

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
    breakpoint: 'base' as const,
    onChangeInstanceStyle: vi.fn(),
    onChangeVariant: vi.fn(),
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
        typeStyle={{ base: {} }}
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
            styleOverride: { base: { borderRadius: '6px' } },
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
        typeStyle={{ base: { borderRadius: '4px' } }}
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
        typeStyle={{ base: {} }}
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

/**
 * A theme may refuse to be dressed at all (`allowStyleOverrides: false` in
 * its theme.json, docs/adr/0021). Until the editor could read that, both
 * styling buttons appeared on such a site, saved what you chose, and the
 * published page ignored it — with nothing anywhere saying why.
 */
describe('BlockToolbarOverlay under a theme that refuses styling', () => {
  const withFields: BlockDescriptor = {
    ...buttonDescriptor,
    fields: [{ kind: 'text', key: 'label', label: 'Testo' }],
  };

  beforeEach(() => {
    vi.mocked(siteApi.getCurrentSite).mockResolvedValue(
      buildSiteStub('locked-theme'),
    );
    vi.mocked(themeApi.fetchThemeCapabilities).mockResolvedValue({
      allowStyleOverrides: false,
    });
  });

  it('offers neither styling button', async () => {
    renderOverlay(
      <BlockToolbarOverlay
        {...baseProps()}
        descriptor={withFields}
        typeStyle={{ base: {} }}
        onChangeTypeStyle={vi.fn()}
      />,
    );

    // Waited for rather than asserted once: both buttons render before
    // the capabilities answer arrives, so a single `queryBy` would pass
    // whatever the answer turned out to be — it would be checking that
    // React has not finished, not that the theme was obeyed.
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /Stile di tutti i blocchi/ }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: /Stile di questo blocco/ }),
      ).toBeNull();
    });
    // Still there, so the two above went away because the theme said so
    // and not because nothing rendered at all.
    expect(
      screen.getByRole('button', { name: /Modifica proprietà/ }),
    ).toBeTruthy();
  });

  // The properties popover is content, not styling: a theme's ceiling is
  // about how the site looks, never about what it says.
  it('still offers the properties popover', async () => {
    renderOverlay(
      <BlockToolbarOverlay {...baseProps()} descriptor={withFields} />,
    );

    expect(
      await screen.findByRole('button', { name: /Modifica proprietà/ }),
    ).toBeTruthy();
  });
});
