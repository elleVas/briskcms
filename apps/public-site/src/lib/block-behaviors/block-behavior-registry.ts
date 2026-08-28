import { backToTopBehaviors } from './back-to-top.js';
import { beforeAfterBehaviors } from './before-after.js';
import { countdownBehaviors } from './countdown.js';
import { formBehaviors } from './form.js';
import { hamburgerMenuBehaviors } from './hamburger-menu.js';
import { imageSliderBehaviors } from './image-slider.js';
import { promoBarBehaviors } from './promo-bar.js';
import { statBehaviors } from './stat.js';
import { tabsBehaviors } from './tabs.js';
import { testimonialsBehaviors } from './testimonials.js';
import { turnstileBehaviors } from './turnstile.js';
import type { BlockBehavior } from './types.js';

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
  ImageSlider: imageSliderBehaviors,
  Testimonials: testimonialsBehaviors,
  BackToTop: backToTopBehaviors,
  PromoBar: promoBarBehaviors,
  BeforeAfter: beforeAfterBehaviors,
  Stat: statBehaviors,
  Form: [...formBehaviors, ...turnstileBehaviors],
  NewsletterSignup: turnstileBehaviors,
};
