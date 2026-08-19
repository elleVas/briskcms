import type { ComponentConfig } from '@puckeditor/core';
import {
  languageSwitcherPropsSchema,
  type LanguageSwitcherProps,
} from '@brisk/shared-types';

export { languageSwitcherPropsSchema, type LanguageSwitcherProps };

// Not LanguageSwitcherProps directly: Zod's `$strict` marker gives the
// inferred type an implicit string index, which breaks Puck's own
// PuckComponent mapped type (`{[K in keyof Props]}` collapses to
// `{[x: string]: never}` instead of a real empty object). A nominal
// empty interface keeps `keyof` at `never`, as Puck's own types expect
// for a block with no fields — same reasoning as header.block.tsx's
// HeaderPuckProps, just with no slot field either.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface LanguageSwitcherPuckProps {}

export const languageSwitcherConfig: ComponentConfig<LanguageSwitcherPuckProps> =
  {
    label: 'Selettore lingua',
    fields: {},
    defaultProps: {},
    // Canvas-only placeholder — the real links depend on which page a
    // visitor is looking at (site.enabledLocales/translations of THAT
    // page), a runtime fact never known in the editor canvas. Same
    // principle as the Form block's placeholder (docs/adr/0015).
    render: () => (
      <div
        style={{
          border: '2px dashed #d4d4d8',
          borderRadius: 8,
          padding: 8,
          textAlign: 'center',
          color: '#71717a',
          fontSize: 14,
        }}
      >
        IT · EN (selettore lingua)
      </div>
    ),
  };
