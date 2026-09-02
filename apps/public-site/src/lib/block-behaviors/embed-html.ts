import type { BlockBehavior } from './types';

// Idempotency guard: re-running this on the SAME iframe would attach a
// second `message` listener, double-setting the same height — harmless
// but wasteful. See run-block-behaviors.ts.
const INITIALIZED_ATTR = 'data-brisk-embed-html-initialized';

// One listener per iframe instance (not one page-level listener matching
// by `event.source`) — several EmbedHtml blocks can coexist, and this
// shape is what lets a live-inserted block get wired up on its own too,
// the same as every other block behavior.
function wireEmbedHtmlResize(frame: HTMLElement): void {
  if (
    !(frame instanceof HTMLIFrameElement) ||
    frame.hasAttribute(INITIALIZED_ATTR)
  ) {
    return;
  }
  frame.setAttribute(INITIALIZED_ATTR, '');

  window.addEventListener('message', (event) => {
    const data = event.data as { briskEmbedHtmlHeight?: unknown } | null;
    if (!data || typeof data.briskEmbedHtmlHeight !== 'number') return;
    if (frame.contentWindow === event.source) {
      frame.style.height = `${data.briskEmbedHtmlHeight}px`;
    }
  });
}

export const embedHtmlBehaviors: BlockBehavior[] = [
  { selector: '.brisk-embed-html__frame', wire: wireEmbedHtmlResize },
];
