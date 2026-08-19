import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import {
  hamburgerMenuPropsSchema,
  type HamburgerMenuProps,
  type Visibility,
} from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';
import { positionField } from '../fields/position-field.js';
import { visibilityField } from '../fields/visibility-field.js';

export { hamburgerMenuPropsSchema, type HamburgerMenuProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `HamburgerMenuProps` (the domain schema) — see nav.block.tsx's own
// comment for why this Puck-only type differs from the domain schema.
// Standalone, not `extends HamburgerMenuProps`: an earlier version of
// this file extended a type inferred from `z.strictObject({})` and hit
// TypeScript re-introducing an implicit index signature through the
// extends clause — every Puck-only props interface in this codebase is a
// plain standalone interface to avoid that regardless of whether the
// domain schema happens to be empty right now.
export interface HamburgerMenuPuckProps {
  position: 'left' | 'right';
  visibility: Visibility;
  children: Slot;
}

const HAMBURGER_COLOR = '#ea580c';

const fields: Fields<HamburgerMenuPuckProps> = {
  position: positionField,
  visibility: visibilityField,
  children: { type: 'slot', allow: ['NavLink', 'LanguageSwitcher'] },
};

// Always visible in the editor canvas, icon and all — a distinct,
// placeable block (like every other block here), not a hidden responsive
// behavior only visible by shrinking a browser window (explicit user
// request, 2026-08-19: "voglio vederlo in editor e piazzarlo come su
// WP"). The 3-bar icon here is static (no real open/close interaction in
// the editor — that only exists on apps/public-site, HamburgerMenu.astro)
// but is enough to recognize and position the block while composing the
// header/footer. `position` matters when this is placed *inside* Nav's
// own slot (nav.block.tsx now allows it there too); `visibility` defaults
// to 'mobile-only' but can be set to 'always' to use it as a general
// "open a panel" trigger even on desktop (e.g. contact info).
export const hamburgerMenuConfig: ComponentConfig<HamburgerMenuPuckProps> = {
  label: 'Menu mobile (hamburger)',
  fields,
  defaultProps: { position: 'left', visibility: 'mobile-only', children: [] },
  render: ({ children: Children }) => (
    <EditorChrome label="Menu mobile (hamburger)" color={HAMBURGER_COLOR}>
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          gap: 4,
          padding: 6,
          border: '1px solid #d4d4d8',
          borderRadius: 6,
        }}
      >
        {[0, 1, 2].map((bar) => (
          <span
            key={bar}
            style={{
              width: 24,
              height: 2,
              borderRadius: 1,
              background: '#18181b',
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <Children />
      </div>
    </EditorChrome>
  ),
};
