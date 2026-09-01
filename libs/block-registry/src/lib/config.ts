import type { BlockDescriptor } from './field-types';
import { accordionBlock } from './blocks/accordion.block';
import { accordionItemBlock } from './blocks/accordion-item.block';
import { bannerBlock } from './blocks/banner.block';
import { beforeAfterBlock } from './blocks/before-after.block';
import { breadcrumbBlock } from './blocks/breadcrumb.block';
import { buttonBlock } from './blocks/button.block';
import { calloutBlock } from './blocks/callout.block';
import { codeBlock } from './blocks/code.block';
import { columnBlock } from './blocks/column.block';
import { columnsBlock } from './blocks/columns.block';
import { containerBlock } from './blocks/container.block';
import { countdownBlock } from './blocks/countdown.block';
import { embedHtmlBlock } from './blocks/embed-html.block';
import { featureBlock } from './blocks/feature.block';
import { featureGridBlock } from './blocks/feature-grid.block';
import { formBlock } from './blocks/form.block';
import { galleryBlock } from './blocks/gallery.block';
import { heroBlock } from './blocks/hero.block';
import { imageSliderBlock } from './blocks/image-slider.block';
import { imageBlock } from './blocks/image.block';
import { linkBlock } from './blocks/link.block';
import { logoStripBlock } from './blocks/logo-strip.block';
import { mapEmbedBlock } from './blocks/map-embed.block';
import { newsletterSignupBlock } from './blocks/newsletter-signup.block';
import { pricingPlanBlock } from './blocks/pricing-plan.block';
import { pricingTableBlock } from './blocks/pricing-table.block';
import { quoteBlock } from './blocks/quote.block';
import { ratingBlock } from './blocks/rating.block';
import { searchBoxBlock } from './blocks/search-box.block';
import { statBlock } from './blocks/stat.block';
import { statsCounterBlock } from './blocks/stats-counter.block';
import { tabBlock } from './blocks/tab.block';
import { tabsBlock } from './blocks/tabs.block';
import { tableBlock } from './blocks/table.block';
import { teamMemberBlock } from './blocks/team-member.block';
import { teamBlock } from './blocks/team.block';
import { testimonialBlock } from './blocks/testimonial.block';
import { testimonialsBlock } from './blocks/testimonials.block';
import { textBlock } from './blocks/text.block';
import { timelineStepBlock } from './blocks/timeline-step.block';
import { timelineBlock } from './blocks/timeline.block';
import { videoEmbedBlock } from './blocks/video-embed.block';

export {
  accordionBlock,
  accordionItemBlock,
  bannerBlock,
  beforeAfterBlock,
  breadcrumbBlock,
  buttonBlock,
  calloutBlock,
  codeBlock,
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
  calloutBlock,
  linkBlock,
  quoteBlock,
  ratingBlock,
  countdownBlock,
  embedHtmlBlock,
  codeBlock,
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
      'Callout',
      'Table',
      'EmbedHtml',
      'Code',
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
