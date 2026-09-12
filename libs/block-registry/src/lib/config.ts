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
import { carouselBlock } from './blocks/carousel.block';
import { cardBlock } from './blocks/card.block';
import { dividerBlock } from './blocks/divider.block';
import { iconBlock } from './blocks/icon.block';
import { socialLinkBlock } from './blocks/social-link.block';
import { socialLinksBlock } from './blocks/social-links.block';
import { spacerBlock } from './blocks/spacer.block';
import { videoFileBlock } from './blocks/video-file.block';
import { audioBlock } from './blocks/audio.block';
import { containerBlock } from './blocks/container.block';
import { countdownBlock } from './blocks/countdown.block';
import { embedHtmlBlock } from './blocks/embed-html.block';
import { featureBlock } from './blocks/feature.block';
import { featureGridBlock } from './blocks/feature-grid.block';
import { formBlock } from './blocks/form.block';
import { galleryBlock } from './blocks/gallery.block';
import { headingBlock } from './blocks/heading.block';
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
import { articleMetaBlock } from './blocks/article-meta.block';
import { articleNavBlock } from './blocks/article-nav.block';
import { pageGridBlock } from './blocks/page-grid.block';
import { relatedPagesBlock } from './blocks/related-pages.block';
import { searchBoxBlock } from './blocks/search-box.block';
import { sectionBlock } from './blocks/section.block';
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
  carouselBlock,
  cardBlock,
  sectionBlock,
  dividerBlock,
  spacerBlock,
  iconBlock,
  socialLinksBlock,
  socialLinkBlock,
  videoFileBlock,
  audioBlock,
  containerBlock,
  countdownBlock,
  embedHtmlBlock,
  featureBlock,
  featureGridBlock,
  formBlock,
  galleryBlock,
  headingBlock,
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
  pageGridBlock,
  articleMetaBlock,
  articleNavBlock,
  relatedPagesBlock,
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
 * The page blocks (docs/adr/0007) — "not registered = not droppable",
 * no deny-list. Data only (fields/defaultProps), no `render`: the real
 * Astro component in apps/public-site is the only renderer, shown live
 * in the canvas inside an iframe (see the visual editor plan). Breadcrumb
 * is here (not among the Header/Footer blocks in layout-config.ts, see
 * the comment there) because it's intrinsically per-page content.
 */
export const pageBlocks: BlockDescriptor[] = [
  heroBlock,
  headingBlock,
  textBlock,
  imageBlock,
  galleryBlock,
  formBlock,
  breadcrumbBlock,
  columnsBlock,
  columnBlock,
  containerBlock,
  cardBlock,
  carouselBlock,
  sectionBlock,
  dividerBlock,
  spacerBlock,
  iconBlock,
  socialLinksBlock,
  socialLinkBlock,
  videoFileBlock,
  audioBlock,
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
  pageGridBlock,
  articleMetaBlock,
  articleNavBlock,
  relatedPagesBlock,
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

/** Grouping for the block picker — every block above appears in exactly one category here, no automatic fallback bucket for a forgotten one. */
export const pageBlockCategories: { title: string; types: string[] }[] = [
  {
    title: 'blocks.categories.layout',
    types: [
      'Columns',
      'Column',
      'Container',
      'Card',
      'Section',
      'Carousel',
      'Divider',
      'Spacer',
    ],
  },
  {
    title: 'blocks.categories.content',
    types: [
      'Hero',
      'Heading',
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
      'Icon',
      'PageGrid',
      'ArticleMeta',
      'ArticleNav',
      'RelatedPages',
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
      'SocialLinks',
      'SocialLink',
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
      'VideoFile',
      'Audio',
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
