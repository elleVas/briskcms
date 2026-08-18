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
});
