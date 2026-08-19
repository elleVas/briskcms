import type { Config } from '@puckeditor/core';
import {
  hamburgerMenuConfig,
  type HamburgerMenuPuckProps,
} from './blocks/hamburger-menu.block.js';
import {
  languageSwitcherConfig,
  type LanguageSwitcherProps,
} from './blocks/language-switcher.block.js';
import {
  navDropdownConfig,
  type NavDropdownPuckProps,
} from './blocks/nav-dropdown.block.js';
import { navConfig, type NavPuckProps } from './blocks/nav.block.js';
import { navLinkConfig, type NavLinkProps } from './blocks/nav-link.block.js';
import { imageConfig, type ImageProps } from './blocks/image.block.js';
import { textConfig, type TextProps } from './blocks/text.block.js';

export interface BriskLayoutComponentProps {
  Nav: NavPuckProps;
  NavLink: NavLinkProps;
  LanguageSwitcher: LanguageSwitcherProps;
  HamburgerMenu: HamburgerMenuPuckProps;
  NavDropdown: NavDropdownPuckProps;
  Text: TextProps;
  Image: ImageProps;
}

/**
 * Shared by both the Header and Footer editors (docs/adr/0018): a
 * site_layout_section's `content` for kind='header'/'footer' is directly
 * this list of blocks — there is no Header/Footer wrapper block, the
 * <header>/<footer> tag itself is supplied by apps/public-site (PR3), not
 * stored as a Block. One config, not two, because both editors offer the
 * exact same building-block palette; what makes one "the header" and the
 * other "the footer" is the `kind` on the entity being edited, not
 * anything Puck-visible. A non-technical editor structurally cannot drag a
 * Hero/Gallery/Form (or a "footer" — there is no such component) into
 * either — it's simply not in this component picker's list, no runtime
 * validation to keep in sync separately.
 */
export const headerFooterPuckConfig: Config<BriskLayoutComponentProps> = {
  components: {
    Nav: navConfig,
    NavLink: navLinkConfig,
    LanguageSwitcher: languageSwitcherConfig,
    HamburgerMenu: hamburgerMenuConfig,
    NavDropdown: navDropdownConfig,
    Text: textConfig,
    Image: imageConfig,
  },
};
