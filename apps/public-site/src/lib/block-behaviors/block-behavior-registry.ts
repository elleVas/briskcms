import { backToTopBehaviors } from './back-to-top';
import { beforeAfterBehaviors } from './before-after';
import { consentGatedEmbedBehaviors } from './consent-gated-embed';
import { countdownBehaviors } from './countdown';
import { embedHtmlBehaviors } from './embed-html';
import { formBehaviors } from './form';
import { collectionBehaviors } from './collection';
import { lightboxBehaviors } from './lightbox';
import { hamburgerMenuBehaviors } from './hamburger-menu';
import { promoBarBehaviors } from './promo-bar';
import { statBehaviors } from './stat';
import { tabsBehaviors } from './tabs';
import { turnstileBehaviors } from './turnstile';
import type { BlockBehavior } from './types';

// Keyed by Block.type (see @brisk/shared-types), for the preview-bridge
// dispatcher (run-block-behaviors-in-subtree.ts) — re-runs a live-inserted
// or live-patched block's own client-side behaviors, which an innerHTML-
// style DOM update never executes on its own (see that file's own comment
// for why). Every block listed here also runs the exact same behaviors
// itself, once, from its own <script> at initial page load — this registry
// exists purely for the live-update case, it isn't the only place these
// run. Form and NewsletterSignup both register turnstileBehaviors: either
// can render a Turnstile widget, and the guard in turnstile.ts makes
// registering it twice on one page harmless.
export const BLOCK_BEHAVIOR_REGISTRY: Record<string, BlockBehavior[]> = {
  Tabs: tabsBehaviors,
  HamburgerMenu: hamburgerMenuBehaviors,
  Countdown: countdownBehaviors,
  // Every collection wires the same engine (ADR-0052) — the behaviour
  // itself only matches the scrolling arrangements, so listing a block
  // that is currently a grid costs nothing and keeps working the moment
  // somebody switches it.
  ImageSlider: collectionBehaviors,
  Testimonials: collectionBehaviors,
  Team: collectionBehaviors,
  FeatureGrid: collectionBehaviors,
  PricingTable: collectionBehaviors,
  StatsCounter: collectionBehaviors,
  Carousel: collectionBehaviors,
  SocialLinks: collectionBehaviors,
  // Both offer a lightbox (ADR-0057) and share one behaviour — the
  // overlay, its focus trap and its Escape key exist once.
  Image: lightboxBehaviors,
  Gallery: lightboxBehaviors,
  BackToTop: backToTopBehaviors,
  PromoBar: promoBarBehaviors,
  BeforeAfter: beforeAfterBehaviors,
  Stat: statBehaviors,
  Form: [...formBehaviors, ...turnstileBehaviors],
  NewsletterSignup: turnstileBehaviors,
  VideoEmbed: consentGatedEmbedBehaviors,
  MapEmbed: consentGatedEmbedBehaviors,
  EmbedHtml: embedHtmlBehaviors,
};
