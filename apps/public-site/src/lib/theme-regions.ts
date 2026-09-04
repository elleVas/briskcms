import type { Translator } from './i18n';
import type { PageTreeNodeDto } from './public-api-client';

/**
 * docs/adr/0042's successor — le tre regioni che un tema può fornire al
 * posto dei wrapper del core, senza reimplementare la shell.
 *
 * I tipi vivono qui e non in `resolve-theme-regions.ts` di proposito: quel
 * file fa un `import.meta.glob` sui file dei temi, e un tema che importasse
 * le proprie props da lì creerebbe un ciclo che oggi non esiste.
 *
 * Cosa resta SEMPRE del core, e che un tema non può quindi rompere: tutto
 * `<html>`/`<head>`/`<body>`, il link "salta al contenuto", gli attributi
 * `data-brisk-root-blocks` su cui si aggancia l'editor visuale, il
 * rendering dei blocchi, la CSP, il consent, schema.org e il preview
 * bridge. Un frammento riceve i blocchi già renderizzati come slot e
 * decide solo l'elemento che li avvolge.
 */
export type ThemeRegionRoute = 'page' | 'search' | 'error';

export interface ThemeRegionProps {
  locale: string;
  /** `Astro.url.pathname` senza slash finali, `'/'` per la radice. */
  currentPath: string;
  /** Il dizionario di UI del core, già legato a `locale`. */
  i18n: Translator;
  /**
   * L'albero delle pagine pubblicate del sito. Recuperato al massimo una
   * volta per richiesta e solo se il frammento lo chiama davvero: fetch,
   * memoizzazione, guardia sul dominio e politica d'errore (risolve a `[]`,
   * non lancia mai) sono del core, non del tema — è esattamente il genere
   * di cosa che una copia sbaglia.
   */
  pageTree: () => Promise<PageTreeNodeDto[]>;
  /** Quale rotta del core sta renderizzando. */
  route: ThemeRegionRoute;
  /** Vero solo dentro l'iframe di anteprima dell'editor. */
  editable: boolean;
  /**
   * Iniettata da Astro perché il layout del core ha `<style>` propri:
   * inoltrala sull'elemento radice del frammento per far arrivare gli stili
   * scoped del core, oppure ignorala.
   */
  class?: string;
}

export interface ThemeHeaderProps extends ThemeRegionProps {
  /** Configurato per (sito, locale) dall'editor — il tema decide come renderlo. */
  sticky: boolean;
}

export type ThemeFooterProps = ThemeRegionProps;
export type ThemeContentShellProps = ThemeRegionProps;
