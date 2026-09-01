/** Shared save/publish status shape — every canvas-backed editor (page group, header/footer section) tracks its own draft/publish lifecycle through this same type. */
export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'published' }
  | { kind: 'error'; message: string };
