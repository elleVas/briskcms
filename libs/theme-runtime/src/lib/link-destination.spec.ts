import { describe, expect, it } from 'vitest';
import { resolveLinkHref } from './link-destination';

describe('resolveLinkHref', () => {
  it('builds the locale path of the picked page, ancestors included', () => {
    expect(
      resolveLinkHref({
        linkType: 'page',
        page: { locale: 'it', slug: 'prezzi', ancestorSlugs: ['docs'] },
        url: 'https://example.com',
      }),
    ).toBe('/it/docs/prezzi');
  });

  it('returns the url when that is what the block points at', () => {
    expect(
      resolveLinkHref({ linkType: 'url', url: 'https://example.com' }),
    ).toBe('https://example.com');
  });

  /*
   * The bug this function exists for. Every component used to fall back
   * to `url` whenever the page did not resolve — so a block whose author
   * chose "Site page" and never picked one linked to a URL the editor
   * stopped showing at all once the fields became conditional
   * (ADR-0062).
   */
  it('points nowhere when the type says page and no page is picked, even with a url set', () => {
    expect(
      resolveLinkHref({
        linkType: 'page',
        page: null,
        url: 'https://example.com',
      }),
    ).toBeNull();
  });

  /*
   * `resolvePageReferences` nulls the reference when the target has no
   * translation in the locale being rendered (deleted, or never
   * translated). Its own comment already calls that "nothing to link
   * to" — this is where that becomes true.
   */
  it('points nowhere when the picked page has no address in this locale', () => {
    expect(
      resolveLinkHref({
        linkType: 'page',
        page: { locale: 'it' },
        url: '/fallback',
      }),
    ).toBeNull();
  });

  /*
   * `href=""` is not an inert link: the empty string resolves against the
   * current document, so clicking reloads the page — which is what an
   * unfilled url field used to produce.
   */
  it('points nowhere for an empty or blank url', () => {
    expect(resolveLinkHref({ linkType: 'url', url: '' })).toBeNull();
    expect(resolveLinkHref({ linkType: 'url', url: '   ' })).toBeNull();
  });

  it("points nowhere when the type is 'none', whatever else is filled in", () => {
    expect(
      resolveLinkHref({
        linkType: 'none',
        page: { locale: 'it', slug: 'prezzi' },
        url: 'https://example.com',
      }),
    ).toBeNull();
  });
});
