import type { CSSProperties, ReactNode } from 'react';

export interface EditorChromeProps {
  label: string;
  color: string;
  children: ReactNode;
}

const labelStyle: CSSProperties = {
  position: 'absolute',
  top: -10,
  left: 8,
  padding: '0 6px',
  background: '#fff',
  fontSize: 11,
  fontWeight: 600,
};

/**
 * Editor-canvas-only visual boundary for a structural container block
 * (currently just Nav) — a colored dashed border + label so a dropped-in
 * child visibly reads as "nested inside this" instead of looking flat
 * (Gutenberg-style block chrome, requested explicitly after the plain
 * `<nav><Children/></nav>` render gave no such cue). Never reaches the
 * public site: apps/public-site renders its own separate .astro components
 * (docs/adr/0007) and never imports anything from this library.
 */
export function EditorChrome({ label, color, children }: EditorChromeProps) {
  return (
    <div
      style={{
        position: 'relative',
        border: `2px dashed ${color}`,
        borderRadius: 8,
        padding: '18px 10px 10px',
      }}
    >
      <span style={{ ...labelStyle, color }}>{label}</span>
      {children}
    </div>
  );
}
