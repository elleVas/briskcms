import type { BlockBehavior } from './types';

const INITIALIZED_ATTR = 'data-brisk-cookie-preferences-initialized';

/**
 * Opens the cookie banner's preferences panel — through the consent API
 * when it is there, and by the event that API itself dispatches when it
 * is not yet, so the order the two scripts load in does not matter
 * (cookie-consent-bootstrap.ts, cookie-consent-panel-script.ts).
 */
function wireCookiePreferences(button: HTMLElement): void {
  if (button.hasAttribute(INITIALIZED_ATTR)) return;
  button.setAttribute(INITIALIZED_ATTR, '');
  button.addEventListener('click', () => {
    const view = button.ownerDocument.defaultView;
    const consent: Partial<Window['briskConsent']> | undefined =
      view?.briskConsent;
    if (typeof consent?.openPreferences === 'function') {
      consent.openPreferences();
      return;
    }
    button.ownerDocument.dispatchEvent(
      new CustomEvent('brisk-consent-open-preferences'),
    );
  });
}

export const cookiePreferencesBehaviors: BlockBehavior[] = [
  { selector: '[data-brisk-cookie-preferences]', wire: wireCookiePreferences },
];
