import type { BlockDescriptor } from './field-types.js';
import { accordionBlock } from './blocks/accordion.block.js';
import { accordionItemBlock } from './blocks/accordion-item.block.js';
import { bannerBlock } from './blocks/banner.block.js';
import { beforeAfterBlock } from './blocks/before-after.block.js';
import { breadcrumbBlock } from './blocks/breadcrumb.block.js';
import { buttonBlock } from './blocks/button.block.js';
import { columnBlock } from './blocks/column.block.js';
import { columnsBlock } from './blocks/columns.block.js';
import { containerBlock } from './blocks/container.block.js';
import { countdownBlock } from './blocks/countdown.block.js';
import { embedHtmlBlock } from './blocks/embed-html.block.js';
import { featureBlock } from './blocks/feature.block.js';
import { featureGridBlock } from './blocks/feature-grid.block.js';
import { formBlock } from './blocks/form.block.js';
import { galleryBlock } from './blocks/gallery.block.js';
import { heroBlock } from './blocks/hero.block.js';
import { imageSliderBlock } from './blocks/image-slider.block.js';
import { imageBlock } from './blocks/image.block.js';
import { linkBlock } from './blocks/link.block.js';
import { logoStripBlock } from './blocks/logo-strip.block.js';
import { mapEmbedBlock } from './blocks/map-embed.block.js';
import { newsletterSignupBlock } from './blocks/newsletter-signup.block.js';
import { pricingPlanBlock } from './blocks/pricing-plan.block.js';
import { pricingTableBlock } from './blocks/pricing-table.block.js';
import { quoteBlock } from './blocks/quote.block.js';
import { ratingBlock } from './blocks/rating.block.js';
import { searchBoxBlock } from './blocks/search-box.block.js';
import { statBlock } from './blocks/stat.block.js';
import { statsCounterBlock } from './blocks/stats-counter.block.js';
import { tabBlock } from './blocks/tab.block.js';
import { tabsBlock } from './blocks/tabs.block.js';
import { tableBlock } from './blocks/table.block.js';
import { teamMemberBlock } from './blocks/team-member.block.js';
import { teamBlock } from './blocks/team.block.js';
import { testimonialBlock } from './blocks/testimonial.block.js';
import { testimonialsBlock } from './blocks/testimonials.block.js';
import { textBlock } from './blocks/text.block.js';
import { timelineStepBlock } from './blocks/timeline-step.block.js';
import { timelineBlock } from './blocks/timeline.block.js';
import { videoEmbedBlock } from './blocks/video-embed.block.js';

export {
  accordionBlock,
  accordionItemBlock,
  bannerBlock,
  beforeAfterBlock,
  breadcrumbBlock,
  buttonBlock,
  columnBlock,
  columnsBlock,
  containerBlock,
  countdownBlock,
  embedHtmlBlock,
  featureBlock,
  featureGridBlock,
  formBlock,
  galleryBlock,
  heroBlock,
  imageSliderBlock,
  imageBlock,
  linkBlock,
  logoStripBlock,
  mapEmbedBlock,
  newsletterSignupBlock,
  pricingPlanBlock,
  pricingTableBlock,
  quoteBlock,
  ratingBlock,
  searchBoxBlock,
  statBlock,
  statsCounterBlock,
  tabBlock,
  tabsBlock,
  tableBlock,
  teamMemberBlock,
  teamBlock,
  testimonialBlock,
  testimonialsBlock,
  textBlock,
  timelineStepBlock,
  timelineBlock,
  videoEmbedBlock,
};

/**
 * I 40 blocchi pagina (docs/adr/0007) — "non registrato = non droppabile",
 * nessuna deny-list. Solo dati (fields/defaultProps), nessun `render`: il
 * vero componente Astro in apps/public-site è l'unico renderer, mostrato
 * dal vivo nel canvas dentro un iframe (vedi il piano dell'editor visuale).
 * Breadcrumb è qui (non tra i blocchi Header/Footer di layout-config.ts,
 * vedi il commento lì) perché è contenuto intrinsecamente per-pagina.
 */
export const pageBlocks: BlockDescriptor[] = [
  heroBlock,
  textBlock,
  imageBlock,
  galleryBlock,
  formBlock,
  breadcrumbBlock,
  columnsBlock,
  columnBlock,
  containerBlock,
  linkBlock,
  quoteBlock,
  ratingBlock,
  countdownBlock,
  embedHtmlBlock,
  tableBlock,
  accordionBlock,
  accordionItemBlock,
  tabsBlock,
  tabBlock,
  bannerBlock,
  buttonBlock,
  featureGridBlock,
  featureBlock,
  searchBoxBlock,
  videoEmbedBlock,
  mapEmbedBlock,
  imageSliderBlock,
  beforeAfterBlock,
  logoStripBlock,
  testimonialsBlock,
  testimonialBlock,
  teamBlock,
  teamMemberBlock,
  pricingTableBlock,
  pricingPlanBlock,
  statsCounterBlock,
  statBlock,
  timelineBlock,
  timelineStepBlock,
  newsletterSignupBlock,
];

/** Raggruppamento per il selettore blocchi — ogni blocco sopra compare in esattamente una categoria qui, nessun bucket di fallback automatico per uno dimenticato. */
export const pageBlockCategories: { title: string; types: string[] }[] = [
  {
    title: 'blocks.categories.layout',
    types: ['Columns', 'Column', 'Container'],
  },
  {
    title: 'blocks.categories.content',
    types: [
      'Hero',
      'Text',
      'Link',
      'Image',
      'Gallery',
      'Quote',
      'Table',
      'EmbedHtml',
      'Breadcrumb',
    ],
  },
  {
    title: 'blocks.categories.conversion',
    types: [
      'Form',
      'NewsletterSignup',
      'Button',
      'SearchBox',
      'Countdown',
      'Banner',
    ],
  },
  {
    title: 'blocks.categories.media',
    types: [
      'VideoEmbed',
      'MapEmbed',
      'ImageSlider',
      'BeforeAfter',
      'LogoStrip',
      'Rating',
    ],
  },
  {
    title: 'blocks.categories.socialProof',
    types: [
      'Testimonials',
      'Testimonial',
      'Team',
      'TeamMember',
      'PricingTable',
      'PricingPlan',
      'StatsCounter',
      'Stat',
      'Timeline',
      'TimelineStep',
    ],
  },
  {
    title: 'blocks.categories.interactive',
    types: [
      'Accordion',
      'AccordionItem',
      'Tabs',
      'Tab',
      'FeatureGrid',
      'Feature',
    ],
  },
];
