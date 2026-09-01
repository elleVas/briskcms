import type { BlockDescriptor } from '../field-types';
import { positionField } from '../fields/position-field';
import { visibilityField } from '../fields/visibility-field';

// `position`/`visibility` instead of HamburgerMenuProps directly: at the
// domain level this block combines navItemPositionSchema (its position
// within the Nav) with its own visibility, exactly like
// hamburgerMenuPropsSchema in content-model.ts. No extra Puck-only type
// is needed here: Block.children is already real.
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
