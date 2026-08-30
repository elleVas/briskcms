import type { BlockDescriptor } from './field-types';
import { backToTopBlock } from './blocks/back-to-top.block';
import { hamburgerMenuBlock } from './blocks/hamburger-menu.block';
import { languageSwitcherBlock } from './blocks/language-switcher.block';
import { navDropdownBlock } from './blocks/nav-dropdown.block';
import { navLinkBlock } from './blocks/nav-link.block';
import { navBlock } from './blocks/nav.block';
import { promoBarBlock } from './blocks/promo-bar.block';
import { whatsAppButtonBlock } from './blocks/whatsapp-button.block';
import { imageBlock } from './blocks/image.block';
import { searchBoxBlock } from './blocks/search-box.block';
import { textBlock } from './blocks/text.block';

export {
  backToTopBlock,
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
 * 11 blocchi totali: 8 esclusivi (sotto) + Text/Image/SearchBox riusati
 * da @brisk/block-registry's config.ts (stessi descrittori, stesso
 * componente Astro — nessuna duplicazione). Breadcrumb NON è più qui
 * (spostato tra i blocchi pagina in config.ts, 2026-08-22): è contenuto
 * intrinsecamente per-pagina (dipende dalla posizione della pagina nella
 * gerarchia), editarlo come parte dell'Header/Footer condiviso — pur
 * "funzionando" grazie ad ancestors/currentPageTitle passati dinamicamente
 * da BlockRenderer — lo rendeva concettualmente un blocco di pagina
 * travestito da blocco di sezione condivisa.
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
  searchBoxBlock,
];
