import type { BlockDescriptor } from '../field-types.js';
import { positionField } from '../fields/position-field.js';
import { visibilityField } from '../fields/visibility-field.js';

// `position`/`visibility` invece di HamburgerMenuProps direttamente: a
// livello di dominio questo blocco combina navItemPositionSchema (la sua
// posizione dentro il Nav) con la propria visibility, esattamente come
// hamburgerMenuPropsSchema in content-model.ts. Nessun tipo Puck-only
// extra serve qui: Block.children è già reale.
export const hamburgerMenuBlock: BlockDescriptor<{
  position: 'left' | 'right';
  visibility: 'always' | 'desktop-only' | 'mobile-only';
}> = {
  type: 'HamburgerMenu',
  label: 'blocks.hamburgerMenu.label',
  category: 'navigation',
  defaultProps: { position: 'left', visibility: 'mobile-only' },
  fields: [positionField, visibilityField],
  isContainer: true,
  allowedChildTypes: ['NavLink', 'LanguageSwitcher'],
};
