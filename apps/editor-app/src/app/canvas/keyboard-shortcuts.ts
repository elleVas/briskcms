/**
 * The editor's keyboard, written down.
 *
 * Every one of these has worked since Fase 7 and none of the app's 1036
 * translated strings mentioned any of them: searching for "shortcut",
 * "keyboard", "help" or "tour" found nothing, so the best part of the
 * editor was reachable only by somebody who already knew it was there.
 *
 * The list lives beside use-canvas-shortcuts.ts on purpose — a card that
 * drifts from the handler is worse than no card, and this way the two are
 * read together.
 */

export interface KeyboardShortcut {
  /** i18n key for what it does. */
  labelKey:
    | 'canvas.shortcuts.undo'
    | 'canvas.shortcuts.redo'
    | 'canvas.shortcuts.duplicate'
    | 'canvas.shortcuts.copy'
    | 'canvas.shortcuts.paste'
    | 'canvas.shortcuts.delete'
    | 'canvas.shortcuts.moveUp'
    | 'canvas.shortcuts.moveDown';
  /** `mod` stands for the platform's own modifier — see `formatShortcut`. */
  keys: string[];
}

export const CANVAS_SHORTCUTS: readonly KeyboardShortcut[] = [
  { labelKey: 'canvas.shortcuts.undo', keys: ['mod', 'Z'] },
  { labelKey: 'canvas.shortcuts.redo', keys: ['mod', '⇧', 'Z'] },
  { labelKey: 'canvas.shortcuts.duplicate', keys: ['mod', 'D'] },
  { labelKey: 'canvas.shortcuts.copy', keys: ['mod', 'C'] },
  { labelKey: 'canvas.shortcuts.paste', keys: ['mod', 'V'] },
  { labelKey: 'canvas.shortcuts.delete', keys: ['⌫'] },
  { labelKey: 'canvas.shortcuts.moveUp', keys: ['⌥', '↑'] },
  { labelKey: 'canvas.shortcuts.moveDown', keys: ['⌥', '↓'] },
];

/**
 * Whether this machine spells the modifier ⌘ or Ctrl.
 *
 * `navigator.platform` is deprecated and `userAgentData` is not everywhere,
 * so it reads whichever it finds — and being wrong costs a wrong glyph in a
 * tooltip, not a broken shortcut: the handler itself accepts both
 * (`event.ctrlKey || event.metaKey`).
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ??
    navigator.platform ??
    navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** "⌘Z" or "Ctrl+Z" — one string, for a tooltip or a card. */
export function formatShortcut(keys: readonly string[]): string {
  const apple = isApplePlatform();
  const spelled = keys.map((key) =>
    key === 'mod' ? (apple ? '⌘' : 'Ctrl') : key,
  );
  return apple ? spelled.join('') : spelled.join('+');
}
