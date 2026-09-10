import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { BlockDescriptor } from '@brisk/block-registry';
import * as api from '../lib/sites-api-client';
import * as themeApi from '../lib/theme-api-client';
import type { SiteRecord } from '@brisk/shared-types';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import { createTestQueryClient } from '../test-query-client';
import { TooltipProvider } from '../components/ui/tooltip';
import {
  GlobalStylesDialog,
  typeStylableProperties,
} from './global-styles-dialog';

const heroDescriptor: BlockDescriptor = {
  type: 'Hero',
  label: 'Hero',
  category: 'content',
  defaultProps: { title: '', subtitle: '' },
  fields: [],
  stylableProperties: ['backgroundColor', 'textColor', 'borderRadius'],
};
const textDescriptor: BlockDescriptor = {
  type: 'Text',
  label: 'Testo',
  category: 'content',
  defaultProps: { body: '' },
  fields: [],
  // No stylableProperties: it must not appear in the "Style per block" list.
};
const registry = [heroDescriptor, textDescriptor];
const categories = [{ title: 'Contenuto', types: ['Hero', 'Text'] }];

vi.mock('../lib/sites-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client')>();
  return {
    ...actual,
    getCurrentSite: vi.fn(),
    updateThemeSettings: vi.fn(),
    updateThemePackage: vi.fn(),
    listAvailableThemes: vi
      .fn()
      .mockResolvedValue([{ name: 'classic' }, { name: 'docs-showcase' }]),
  };
});

// No resolved defaults in these tests — they are not what these tests are
// about, and without a mock the query would make a real network fetch
// (non-deterministic behaviour, dependent on what is running on the
// machine running the tests). Empty = the fields show the generic
// placeholder as before.
vi.mock('../lib/theme-api-client', () => ({
  fetchBlockStyleDefaults: vi.fn().mockResolvedValue({}),
  fetchThemeIcons: vi.fn().mockResolvedValue([]),
  fetchThemeForegroundTokens: vi.fn().mockResolvedValue({
    primaryForeground: '#ffffff',
    secondaryForeground: '#000000',
  }),
  fetchThemeBaseTokens: vi.fn().mockResolvedValue({}),
  fetchThemeCapabilities: vi.fn().mockResolvedValue({
    allowStyleOverrides: true,
  }),
}));

function buildSite(overrides: Partial<SiteRecord> = {}): SiteRecord {
  return {
    id: 'site-1',
    tenantId: 'tenant-1',
    name: 'Il mio sito',
    domain: null,
    themeName: 'classic',
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
    themeContentWidth: null,
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
    ...overrides,
  };
}

function renderDialog(
  open: boolean,
  onOpenChange = vi.fn(),
  onSaveTypeStyle = vi.fn().mockResolvedValue(undefined),
) {
  // Wrapped exactly as main.tsx wraps the whole app: the breakpoint
  // selector inside uses IconButton, which needs a tooltip context.
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <GlobalStylesDialog
          siteId="site-1"
          open={open}
          onOpenChange={onOpenChange}
          registry={registry}
          categories={categories}
          onSaveTypeStyle={onSaveTypeStyle}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('GlobalStylesDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  /*
   * `marginTop`/`marginBottom` mean nothing for a whole TYPE: the CSS for
   * them comes from `spacingRules`, which the per-instance builder calls
   * and the per-type builder does not (block-style-overrides.ts). Offered
   * here, they stored a value and rendered nothing — a control that looks
   * like it works.
   *
   * The block toolbar filtered them out of its own type popover and this
   * screen did not, so the rule lived in one of the two places that
   * needed it. That popover is gone; this is now the only one.
   */
  it('never offers the two margins, which a type cannot set', () => {
    const withMargins: BlockDescriptor = {
      type: 'Card',
      label: 'blocks.card.label',
      category: 'layout',
      defaultProps: {},
      fields: [],
      stylableProperties: ['borderRadius', 'marginTop', 'marginBottom'],
    };

    expect(typeStylableProperties(withMargins)).toEqual(['borderRadius']);
  });

  it('shows a loading state until the site arrives', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    renderDialog(true);

    expect(screen.getByText('Caricamento...')).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText('Caricamento...')).toBeNull(),
    );
  });

  it('shows both colors off when never customized', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    renderDialog(true);

    await waitFor(() =>
      expect(screen.getByText('Colore primario')).toBeTruthy(),
    );
    expect(screen.queryByDisplayValue('#18181b')).toBeNull();
  });

  it("shows the active theme's own base color as a hint when no site override is set", async () => {
    // *Once*, not a lasting `mockResolvedValue` — this suite's `afterEach`
    // only calls `clearAllMocks` (usage data), not `resetAllMocks`, so a
    // persistent override here would leak into every test after this one.
    vi.mocked(themeApi.fetchThemeBaseTokens).mockResolvedValueOnce({
      primary: '#5b9bd5',
      secondary: '#151b23',
      fontSansValue: 'Sora, sans-serif',
      radius: '1rem',
    });
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    renderDialog(true);

    await waitFor(() =>
      expect(
        screen.getAllByText(
          'Valore di base del tema attivo — personalizzalo qui o modificando il tema stesso',
        ).length,
      ).toBe(2),
    );
  });

  it('keeps the old generic placeholder when the theme has no base tokens (e.g. still on oklch(), like classic)', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    renderDialog(true);

    await waitFor(() =>
      expect(screen.getByText('Colore primario')).toBeTruthy(),
    );
    expect(
      screen.queryByText(
        'Valore di base del tema attivo — personalizzalo qui o modificando il tema stesso',
      ),
    ).toBeNull();
  });

  it('pre-fills the enabled color from the current site', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(
      buildSite({ themePrimaryColor: '#ff0000' }),
    );
    renderDialog(true);

    await waitFor(() => expect(screen.getByText('#ff0000')).toBeTruthy());
  });

  it('shows a contrast warning when the enabled primary color is too close to the theme foreground', async () => {
    // Mocked theme foreground is #ffffff (see the theme-api-client mock
    // above) — a white primary color has zero contrast against it.
    vi.mocked(api.getCurrentSite).mockResolvedValue(
      buildSite({ themePrimaryColor: '#ffffff' }),
    );
    renderDialog(true);

    await waitFor(() =>
      expect(screen.getByText(/Contrasto basso/)).toBeTruthy(),
    );
  });

  it('shows no contrast warning when the color is not enabled', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    renderDialog(true);

    await waitFor(() => screen.getByText('Colore primario'));
    expect(screen.queryByText(/Contrasto basso/)).toBeNull();
  });

  it('shows no contrast warning when the enabled color already passes AA', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(
      buildSite({ themePrimaryColor: '#000000' }),
    );
    renderDialog(true);

    await waitFor(() => screen.getByText('#000000'));
    expect(screen.queryByText(/Contrasto basso/)).toBeNull();
  });

  it('saves the colors category, passing through the other theme-settings fields unchanged', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(
      buildSite({ themeFontFamily: 'inter' }),
    );
    vi.mocked(api.updateThemeSettings).mockResolvedValue(buildSite());
    renderDialog(true);
    await waitFor(() => screen.getByText('Colore primario'));

    fireEvent.click(
      screen.getAllByRole('checkbox', { name: /personalizza/i })[0],
    );
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await waitFor(() =>
      expect(api.updateThemeSettings).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({
          primaryColor: '#18181b',
          fontFamily: 'inter',
        }),
      ),
    );
  });

  it('closes without saving when Chiudi is clicked', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);
    await waitFor(() => screen.getByText('Colore primario'));

    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.updateThemeSettings).not.toHaveBeenCalled();
  });

  it('lists only styleable block types, grouped by category', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    renderDialog(true);
    await waitFor(() => screen.getByText('Contenuto'));

    fireEvent.click(screen.getByText('Contenuto'));

    expect(screen.getByText('Hero')).toBeTruthy();
    expect(screen.queryByText('Testo')).toBeNull();
  });

  it('opens a per-type style editor and saves a field change via onSaveTypeStyle', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    const onSaveTypeStyle = vi.fn().mockResolvedValue(undefined);
    renderDialog(true, vi.fn(), onSaveTypeStyle);
    await waitFor(() => screen.getByText('Contenuto'));
    fireEvent.click(screen.getByText('Contenuto'));
    fireEvent.click(screen.getByText('Hero'));

    await waitFor(() => screen.getByText('Raggio angoli'));
    fireEvent.change(screen.getByPlaceholderText(/9999px/), {
      target: { value: '8px' },
    });

    expect(onSaveTypeStyle).toHaveBeenCalledWith(
      'Hero',
      // The type's own look: this descriptor declares no variants, so
      // there is nothing else the panel could be painting.
      'default',
      expect.objectContaining({ base: { borderRadius: '8px' } }),
    );
  });

  it("marks the site's current theme as selected in the theme dropdown", async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(
      buildSite({ themeName: 'docs-showcase' }),
    );
    renderDialog(true);
    await waitFor(() => screen.getByText('Tema'));

    fireEvent.click(screen.getByRole('combobox'));

    expect(
      screen.getByRole('option', { name: 'docs-showcase', selected: true }),
    ).toBeTruthy();
  });

  it('switches theme immediately on selection, without the Salva button', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    vi.mocked(api.updateThemePackage).mockResolvedValue(
      buildSite({ themeName: 'docs-showcase' }),
    );
    renderDialog(true);
    await waitFor(() => screen.getByText('Tema'));

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'docs-showcase' }));

    await waitFor(() =>
      expect(api.updateThemePackage).toHaveBeenCalledWith('site-1', {
        themeName: 'docs-showcase',
      }),
    );
    expect(api.updateThemeSettings).not.toHaveBeenCalled();
  });

  it('goes back to the list from the per-type editor', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    renderDialog(true);
    await waitFor(() => screen.getByText('Contenuto'));
    fireEvent.click(screen.getByText('Contenuto'));
    fireEvent.click(screen.getByText('Hero'));
    await waitFor(() => screen.getByText('Raggio angoli'));

    fireEvent.click(screen.getByRole('button', { name: /indietro/i }));

    expect(screen.getByText('Colore primario')).toBeTruthy();
  });
});

describe('GlobalStylesDialog under a theme that refuses styling', () => {
  it('says so instead of listing block types', async () => {
    vi.mocked(api.getCurrentSite).mockResolvedValue(buildSite());
    vi.mocked(themeApi.fetchThemeCapabilities).mockResolvedValue({
      allowStyleOverrides: false,
    });

    renderDialog(true);

    // The sentence, not an empty dialog: a panel that simply shows
    // nothing reads as broken, while "this theme does not allow it" is an
    // answer somebody can act on.
    expect(
      await screen.findByText(/tema attivo non permette di stilarlo/i),
    ).toBeTruthy();
  });
});
