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
    businessAddress: null,
    businessPhone: null,
    businessType: null,
    openingHours: null,
    searchEngineIndexingEnabled: false,
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
});
