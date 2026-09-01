// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCookieConsentBootstrap } from './cookie-consent-bootstrap';

const NONCE = 'test-nonce-123';

function runBootstrap() {
  // Same as a browser executing the real `is:inline` script tag — the
  // generated source is a self-contained IIFE that assigns
  // `window.briskConsent`, nothing here needs its return value.
  (0, eval)(buildCookieConsentBootstrap(NONCE));
}

function setCookie(value: object) {
  document.cookie = `brisk_consent=${encodeURIComponent(JSON.stringify(value))}; Path=/`;
}

function clearCookies() {
  document.cookie = 'brisk_consent=; Path=/; Max-Age=0';
}

describe('buildCookieConsentBootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearCookies();
  });

  afterEach(() => {
    clearCookies();
    // @ts-expect-error -- test-only cleanup of a global this script defines.
    delete window.briskConsent;
  });

  it('exposes window.briskConsent with no cookie set', () => {
    runBootstrap();

    expect(window.briskConsent.get()).toBeNull();
    expect(window.briskConsent.has('necessary')).toBe(true);
    expect(window.briskConsent.has('measurement')).toBe(false);
  });

  it('reads an existing consent cookie', () => {
    setCookie({ v: 1, id: 'x', ts: 'now', cats: { measurement: true } });

    runBootstrap();

    expect(window.briskConsent.has('measurement')).toBe(true);
    expect(window.briskConsent.has('experience')).toBe(false);
  });

  it('activates a matching gated template already in the DOM', () => {
    document.body.innerHTML =
      '<template data-brisk-consent="measurement" data-brisk-id="a1"><span id="marker">activated</span></template>';
    setCookie({ v: 1, id: 'x', ts: 'now', cats: { measurement: true } });

    runBootstrap();

    expect(document.querySelector('template')).toBeNull();
    expect(document.getElementById('marker')).not.toBeNull();
  });

  it('does not activate a template for a category not yet consented', () => {
    document.body.innerHTML =
      '<template data-brisk-consent="measurement" data-brisk-id="a1"><span id="marker">activated</span></template>';

    runBootstrap();

    expect(document.querySelector('template')).not.toBeNull();
    expect(document.getElementById('marker')).toBeNull();
  });

  it('stamps the real nonce onto a script cloned out of an activated template', () => {
    document.body.innerHTML =
      '<template data-brisk-consent="measurement" data-brisk-id="a1"><script>window.__ran = true;</script></template>';
    setCookie({ v: 1, id: 'x', ts: 'now', cats: { measurement: true } });

    runBootstrap();

    const script = document.querySelector<HTMLScriptElement>('script[nonce]');
    expect(script?.nonce).toBe(NONCE);
  });

  it('apply() writes a consent cookie and activates newly-granted templates', () => {
    document.body.innerHTML =
      '<template data-brisk-consent="experience" data-brisk-id="a1"><span id="marker">activated</span></template>';

    runBootstrap();
    window.briskConsent.apply({
      functionality: false,
      measurement: false,
      experience: true,
    });

    expect(document.getElementById('marker')).not.toBeNull();
    const record = window.briskConsent.get();
    expect(record?.cats.experience).toBe(true);
    expect(record?.cats.measurement).toBe(false);
    expect(record?.id).toBeTruthy();
  });

  it('openPreferences() dispatches a document event the banner UI listens for', () => {
    runBootstrap();
    let received = false;
    document.addEventListener('brisk-consent-open-preferences', () => {
      received = true;
    });

    window.briskConsent.openPreferences();

    expect(received).toBe(true);
  });
});
