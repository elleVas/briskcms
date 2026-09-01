import type { BlockStyleDefaults } from './site-theme-tokens';

/**
 * L'espressione CSS di default per ciascuna proprietà stilizzabile
 * (docs/adr/0022) di ogni tipo di blocco — copiata 1:1 dal fallback che
 * il `.astro` del blocco già usa (`var(--brisk-override-radius,
 * var(--radius))`), non inventata: questa è la stessa identica sorgente
 * di verità, solo dichiarata qui invece che rimanere visibile solo dentro
 * un file CSS. Vive in shared-types (non in block-registry) perché SIA
 * `libs/block-registry` (BlockDescriptor.defaultStyle, per il picker di
 * editor-app) SIA `apps/public-site`
 * (resolve-theme-block-style-defaults.ts, per l'endpoint
 * `/api/themes/current/block-style-defaults`) ne hanno bisogno — stessa
 * ragione di `block-style-overrides.ts` in questo stesso file, e non solo
 * un capriccio di layering: fare dipendere apps/public-site da
 * `@brisk/block-registry` (un pacchetto orientato ai componenti React
 * dell'editor, non dati puri) ha causato un conflitto reale di risoluzione
 * TypeScript tra la configurazione di Astro e i file di test React del
 * registro — vedi la history di questo file per il dettaglio. shared-types
 * non ha questo problema, essendo già una dipendenza pura di entrambe le
 * app. Un riferimento a un custom property del tema (`var(--x)`) viene
 * risolto contro il `theme.css` del tema attivo solo lato public-site; un
 * letterale (`'transparent'`, `'0.5rem'`) passa invariato.
 */
export const BLOCK_STYLE_DEFAULTS: Record<string, BlockStyleDefaults> = {
  AccordionItem: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0.75rem',
  },
  Accordion: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Banner: {
    backgroundColor: 'var(--secondary)',
    textColor: 'inherit',
    borderRadius: '12px',
    paddingX: '1.5rem',
    paddingY: '2.5rem',
  },
  Button: {
    backgroundColor: 'var(--primary)',
    textColor: 'var(--primary-foreground)',
    borderRadius: 'var(--radius)',
    paddingX: '1.25rem',
    paddingY: '0.5rem',
  },
  Code: {
    backgroundColor: 'transparent',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Column: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Columns: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Container: {
    textColor: 'inherit',
    borderRadius: '0.5rem',
  },
  Countdown: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  EmbedHtml: {
    backgroundColor: 'transparent',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  FeatureGrid: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Feature: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Form: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Hero: {
    backgroundColor: 'transparent',
    textColor: 'var(--foreground)',
    borderRadius: '0',
  },
  Heading: {
    textColor: 'inherit',
  },
  LogoStrip: {
    backgroundColor: 'transparent',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  PricingPlan: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '12px',
    paddingX: '1.5rem',
    paddingY: '1.5rem',
  },
  PricingTable: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  PromoBar: {
    backgroundColor: 'var(--primary)',
    textColor: 'var(--primary-foreground)',
    borderRadius: '0',
    paddingX: '2.5rem',
    paddingY: '0.75rem',
  },
  Quote: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Rating: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Stat: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  StatsCounter: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Tab: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '1rem',
  },
  Tabs: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  TeamMember: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Team: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Testimonial: {
    backgroundColor: 'transparent',
    textColor: 'var(--foreground)',
    borderRadius: '12px',
    paddingX: '1.5rem',
    paddingY: '1.5rem',
  },
  Testimonials: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
    paddingX: '0',
    paddingY: '0',
  },
  Text: {
    textColor: 'inherit',
  },
  Timeline: {
    backgroundColor: 'transparent',
    textColor: 'inherit',
    borderRadius: '0',
  },
};
