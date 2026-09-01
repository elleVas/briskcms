/// <reference types="astro/client" />

import type { BriskConsentApi } from '@brisk/shared-types';

declare global {
  namespace App {
    interface Locals {
      // Generated once per request by middleware.ts, shared with the matched
      // route's own frontmatter (Astro runs it as part of `next()`) so the
      // SAME value ends up both in the CSP header's `script-src` and on the
      // Tier 1 head/body script tags PageLayout.astro renders — see
      // `injectScriptNonce` in lib/content-security-policy.ts for why a
      // nonce has to be applied per-tag rather than inherited.
      cspNonce: string;
    }
  }

  // Defined at runtime by cookie-consent-bootstrap.ts's is:inline script
  // (docs/adr/0039) — CookieConsent.astro's own UI script and its tests
  // read/call this global, never re-implement consent logic themselves.
  interface Window {
    briskConsent: BriskConsentApi;
  }
}

export {};
