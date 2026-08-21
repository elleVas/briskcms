import type { BlockDescriptor } from './field-types.js';
import { backToTopBlock } from './blocks/back-to-top.block.js';
import { breadcrumbBlock } from './blocks/breadcrumb.block.js';
import { hamburgerMenuBlock } from './blocks/hamburger-menu.block.js';
import { languageSwitcherBlock } from './blocks/language-switcher.block.js';
import { navDropdownBlock } from './blocks/nav-dropdown.block.js';
import { navLinkBlock } from './blocks/nav-link.block.js';
import { navBlock } from './blocks/nav.block.js';
import { promoBarBlock } from './blocks/promo-bar.block.js';
import { whatsAppButtonBlock } from './blocks/whatsapp-button.block.js';
import { imageBlock } from './blocks/image.block.js';
import { searchBoxBlock } from './blocks/search-box.block.js';
import { textBlock } from './blocks/text.block.js';

export {
  backToTopBlock,
  breadcrumbBlock,
  hamburgerMenuBlock,
  languageSwitcherBlock,
  navDropdownBlock,
  navLinkBlock,
  navBlock,
  promoBarBlock,
  whatsAppButtonBlock,
};

/**
 * Condiviso da entrambi gli editor Header e Footer (docs/adr/0018): il
 * `content` di un site_layout_section per kind='header'/'footer' è
 * direttamente questa lista di blocchi — non esiste un blocco
 * wrapper Header/Footer, il tag <header>/<footer> è fornito da
 * apps/public-site (PR3), mai salvato come Block. Un solo registro, non
 * due, perché entrambi gli editor offrono la stessa identica palette;
 * cosa rende uno "l'header" e l'altro "il footer" è il `kind` sull'entità
 * in editing, non qualcosa di visibile qui. Un editor non tecnico non può
 * strutturalmente trascinare un Hero/Gallery/Form (o un blocco "footer" —
 * non esiste un componente simile) in nessuno dei due: semplicemente non è
 * in questa lista, nessuna validazione a runtime da tenere sincronizzata a
 * parte.
 *
 * 12 blocchi totali: 9 esclusivi (sotto) + Text/Image/SearchBox riusati
 * da @brisk/block-registry's config.ts (stessi descrittori, stesso
 * componente Astro — nessuna duplicazione).
 */
export const headerFooterBlocks: BlockDescriptor[] = [
  navBlock,
  navLinkBlock,
  languageSwitcherBlock,
  hamburgerMenuBlock,
  navDropdownBlock,
  textBlock,
  imageBlock,
  promoBarBlock,
  backToTopBlock,
  whatsAppButtonBlock,
  breadcrumbBlock,
  searchBoxBlock,
];
