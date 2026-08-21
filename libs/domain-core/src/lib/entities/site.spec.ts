import { describe, expect, it } from 'vitest';
import { Site } from './site.js';

describe('Site entity', () => {
  const props = {
    id: 'site-1',
    tenantId: 'tenant-1',
    name: 'Il mio sito',
    domain: 'example.com',
    defaultLocale: 'it',
    enabledLocales: ['it', 'en'],
    untranslatedPageFallback: 'redirect-to-default' as const,
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
    themeTokens: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('fromProps exposes every prop via its getters', () => {
    const site = Site.fromProps(props);

    expect(site.id).toBe('site-1');
    expect(site.tenantId).toBe('tenant-1');
    expect(site.name).toBe('Il mio sito');
    expect(site.domain).toBe('example.com');
    expect(site.defaultLocale).toBe('it');
    expect(site.enabledLocales).toEqual(['it', 'en']);
    expect(site.untranslatedPageFallback).toBe('redirect-to-default');
    expect(site.businessAddress).toBeNull();
    expect(site.businessPhone).toBeNull();
    expect(site.businessType).toBeNull();
    expect(site.openingHours).toBeNull();
    expect(site.searchEngineIndexingEnabled).toBe(false);
    expect(site.createdAt).toEqual(props.createdAt);
  });

  it('fromProps/toProps round-trip without loss', () => {
    const site = Site.fromProps(props);

    expect(site.toProps()).toEqual(props);
  });

  it('supports a null domain (not yet configured)', () => {
    const site = Site.fromProps({ ...props, domain: null });

    expect(site.domain).toBeNull();
  });

  it('hasBusinessInfo is false when every business field is null', () => {
    const site = Site.fromProps(props);

    expect(site.hasBusinessInfo()).toBe(false);
  });

  it('hasBusinessInfo is true once any business field is set', () => {
    const site = Site.fromProps({ ...props, businessPhone: '+39 02 123' });

    expect(site.hasBusinessInfo()).toBe(true);
  });

  it('updateBusinessInfo replaces the business fields', () => {
    const site = Site.fromProps(props);

    site.updateBusinessInfo({
      businessAddress: 'Via Roma 1, Milano',
      businessPhone: '+39 02 1234567',
      businessType: 'Restaurant',
      openingHours: [{ dayOfWeek: 'monday', ranges: [] }],
    });

    expect(site.businessAddress).toBe('Via Roma 1, Milano');
    expect(site.businessPhone).toBe('+39 02 1234567');
    expect(site.businessType).toBe('Restaurant');
    expect(site.openingHours).toEqual([{ dayOfWeek: 'monday', ranges: [] }]);
    expect(site.hasBusinessInfo()).toBe(true);
  });

  it('updateGeneralSettings replaces the name and domain', () => {
    const site = Site.fromProps(props);

    site.updateGeneralSettings({
      name: 'Nuovo nome',
      domain: 'nuovo.example.com',
    });

    expect(site.name).toBe('Nuovo nome');
    expect(site.domain).toBe('nuovo.example.com');
  });

  it('updateGeneralSettings supports clearing the domain back to null', () => {
    const site = Site.fromProps(props);

    site.updateGeneralSettings({ name: props.name, domain: null });

    expect(site.domain).toBeNull();
  });

  it('updateSeoSettings replaces the search engine indexing flag', () => {
    const site = Site.fromProps(props);

    site.updateSeoSettings({ searchEngineIndexingEnabled: true });

    expect(site.searchEngineIndexingEnabled).toBe(true);
  });

  it('updateLocaleSettings replaces default/enabled locales and the fallback', () => {
    const site = Site.fromProps(props);

    site.updateLocaleSettings({
      defaultLocale: 'en',
      enabledLocales: ['it', 'en', 'fr'],
      untranslatedPageFallback: 'not-available',
    });

    expect(site.defaultLocale).toBe('en');
    expect(site.enabledLocales).toEqual(['it', 'en', 'fr']);
    expect(site.untranslatedPageFallback).toBe('not-available');
  });

  it('themeSettings defaults to every override field null, overridesEnabled true', () => {
    const site = Site.fromProps(props);

    expect(site.themeSettings).toEqual({
      primaryColor: null,
      secondaryColor: null,
      fontFamily: null,
      customCss: null,
      headScript: null,
      bodyScript: null,
      faviconUrl: null,
      overridesEnabled: true,
    });
  });

  it('updateThemeSettings replaces every theme field', () => {
    const site = Site.fromProps(props);

    site.updateThemeSettings({
      primaryColor: '#18181b',
      secondaryColor: '#71717a',
      fontFamily: 'inter',
      customCss: '.brisk-hero { text-transform: uppercase; }',
      headScript: '<script>console.log("head")</script>',
      bodyScript: '<script>console.log("body")</script>',
      faviconUrl: 'https://example.com/favicon.png',
      overridesEnabled: false,
    });

    expect(site.themeSettings).toEqual({
      primaryColor: '#18181b',
      secondaryColor: '#71717a',
      fontFamily: 'inter',
      customCss: '.brisk-hero { text-transform: uppercase; }',
      headScript: '<script>console.log("head")</script>',
      bodyScript: '<script>console.log("body")</script>',
      faviconUrl: 'https://example.com/favicon.png',
      overridesEnabled: false,
    });
  });

  it('themeTokens defaults to every field null when never customized', () => {
    const site = Site.fromProps(props);

    expect(site.themeTokens).toEqual({
      buttons: { borderRadius: null, paddingX: null, paddingY: null },
    });
  });

  it('updateThemeTokens replaces only the categories present in the input', () => {
    const site = Site.fromProps(props);

    site.updateThemeTokens({
      buttons: { borderRadius: '9999px', paddingX: '1.5rem', paddingY: null },
    });

    expect(site.themeTokens).toEqual({
      buttons: { borderRadius: '9999px', paddingX: '1.5rem', paddingY: null },
    });
  });

  it('updateThemeTokens leaves an already-saved category untouched when the input omits it', () => {
    const site = Site.fromProps({
      ...props,
      themeTokens: {
        buttons: { borderRadius: '6px', paddingX: null, paddingY: null },
      },
    });

    site.updateThemeTokens({});

    expect(site.themeTokens).toEqual({
      buttons: { borderRadius: '6px', paddingX: null, paddingY: null },
    });
  });
});
