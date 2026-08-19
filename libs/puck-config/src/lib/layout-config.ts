import type { Config } from '@puckeditor/core';
import { footerConfig, type FooterPuckProps } from './blocks/footer.block.js';
import { headerConfig, type HeaderPuckProps } from './blocks/header.block.js';
import {
  languageSwitcherConfig,
  type LanguageSwitcherPuckProps,
} from './blocks/language-switcher.block.js';
import { navConfig, type NavPuckProps } from './blocks/nav.block.js';
import { navLinkConfig, type NavLinkProps } from './blocks/nav-link.block.js';
import { imageConfig, type ImageProps } from './blocks/image.block.js';
import { textConfig, type TextProps } from './blocks/text.block.js';

export interface BriskLayoutComponentProps {
  Header: HeaderPuckProps;
  Nav: NavPuckProps;
  NavLink: NavLinkProps;
  LanguageSwitcher: LanguageSwitcherPuckProps;
  Footer: FooterPuckProps;
  Text: TextProps;
  Image: ImageProps;
}

/**
 * A separate, restricted Config from `puckConfig` (config.ts) — shared by
 * both the Header and Footer editors (docs/adr/0018). Registers only what
 * belongs inside site chrome: Header/Nav/NavLink/LanguageSwitcher/Footer
 * plus the existing Text/Image (the same `textConfig`/`imageConfig`
 * objects `config.ts` uses, not reimplemented). A non-technical editor
 * structurally cannot drag a Hero/Gallery/Form into the header — it's
 * simply not in this component picker's list, no runtime validation to
 * keep in sync separately.
 */
export const headerFooterPuckConfig: Config<BriskLayoutComponentProps> = {
  components: {
    Header: headerConfig,
    Nav: navConfig,
    NavLink: navLinkConfig,
    LanguageSwitcher: languageSwitcherConfig,
    Footer: footerConfig,
    Text: textConfig,
    Image: imageConfig,
  },
};
