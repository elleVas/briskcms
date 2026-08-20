import type { Config } from '@puckeditor/core';
import {
  accordionConfig,
  type AccordionPuckProps,
} from './blocks/accordion.block.js';
import {
  accordionItemConfig,
  type AccordionItemProps,
} from './blocks/accordion-item.block.js';
import { bannerConfig, type BannerProps } from './blocks/banner.block.js';
import {
  beforeAfterConfig,
  type BeforeAfterProps,
} from './blocks/before-after.block.js';
import { buttonConfig, type ButtonProps } from './blocks/button.block.js';
import { columnConfig, type ColumnPuckProps } from './blocks/column.block.js';
import {
  columnsConfig,
  type ColumnsPuckProps,
} from './blocks/columns.block.js';
import {
  countdownConfig,
  type CountdownProps,
} from './blocks/countdown.block.js';
import {
  embedHtmlConfig,
  type EmbedHtmlProps,
} from './blocks/embed-html.block.js';
import { featureConfig, type FeatureProps } from './blocks/feature.block.js';
import {
  featureGridConfig,
  type FeatureGridPuckProps,
} from './blocks/feature-grid.block.js';
import { formConfig, type FormBlockProps } from './blocks/form.block.js';
import { galleryConfig, type GalleryProps } from './blocks/gallery.block.js';
import { heroConfig, type HeroProps } from './blocks/hero.block.js';
import {
  imageSliderConfig,
  type ImageSliderProps,
} from './blocks/image-slider.block.js';
import { imageConfig, type ImageProps } from './blocks/image.block.js';
import {
  logoStripConfig,
  type LogoStripProps,
} from './blocks/logo-strip.block.js';
import {
  mapEmbedConfig,
  type MapEmbedProps,
} from './blocks/map-embed.block.js';
import {
  pricingPlanConfig,
  type PricingPlanProps,
} from './blocks/pricing-plan.block.js';
import {
  pricingTableConfig,
  type PricingTablePuckProps,
} from './blocks/pricing-table.block.js';
import { quoteConfig, type QuoteProps } from './blocks/quote.block.js';
import { ratingConfig, type RatingProps } from './blocks/rating.block.js';
import {
  searchBoxConfig,
  type SearchBoxProps,
} from './blocks/search-box.block.js';
import { statConfig, type StatProps } from './blocks/stat.block.js';
import {
  statsCounterConfig,
  type StatsCounterPuckProps,
} from './blocks/stats-counter.block.js';
import { tabConfig, type TabPuckProps } from './blocks/tab.block.js';
import { tabsConfig, type TabsPuckProps } from './blocks/tabs.block.js';
import { tableConfig, type TableProps } from './blocks/table.block.js';
import {
  teamMemberConfig,
  type TeamMemberProps,
} from './blocks/team-member.block.js';
import { teamConfig, type TeamPuckProps } from './blocks/team.block.js';
import {
  testimonialConfig,
  type TestimonialProps,
} from './blocks/testimonial.block.js';
import {
  testimonialsConfig,
  type TestimonialsPuckProps,
} from './blocks/testimonials.block.js';
import { textConfig, type TextProps } from './blocks/text.block.js';
import {
  timelineStepConfig,
  type TimelineStepProps,
} from './blocks/timeline-step.block.js';
import {
  timelineConfig,
  type TimelinePuckProps,
} from './blocks/timeline.block.js';
import {
  videoEmbedConfig,
  type VideoEmbedProps,
} from './blocks/video-embed.block.js';

export interface BriskComponentProps {
  Hero: HeroProps;
  Text: TextProps;
  Image: ImageProps;
  Gallery: GalleryProps;
  Form: FormBlockProps;
  Columns: ColumnsPuckProps;
  Column: ColumnPuckProps;
  Quote: QuoteProps;
  Rating: RatingProps;
  Countdown: CountdownProps;
  EmbedHtml: EmbedHtmlProps;
  Table: TableProps;
  Accordion: AccordionPuckProps;
  AccordionItem: AccordionItemProps;
  Tabs: TabsPuckProps;
  Tab: TabPuckProps;
  Banner: BannerProps;
  Button: ButtonProps;
  FeatureGrid: FeatureGridPuckProps;
  Feature: FeatureProps;
  SearchBox: SearchBoxProps;
  VideoEmbed: VideoEmbedProps;
  MapEmbed: MapEmbedProps;
  ImageSlider: ImageSliderProps;
  BeforeAfter: BeforeAfterProps;
  LogoStrip: LogoStripProps;
  Testimonials: TestimonialsPuckProps;
  Testimonial: TestimonialProps;
  Team: TeamPuckProps;
  TeamMember: TeamMemberProps;
  PricingTable: PricingTablePuckProps;
  PricingPlan: PricingPlanProps;
  StatsCounter: StatsCounterPuckProps;
  Stat: StatProps;
  Timeline: TimelinePuckProps;
  TimelineStep: TimelineStepProps;
}

export const puckConfig: Config<BriskComponentProps> = {
  components: {
    Hero: heroConfig,
    Text: textConfig,
    Image: imageConfig,
    Gallery: galleryConfig,
    Form: formConfig,
    Columns: columnsConfig,
    Column: columnConfig,
    Quote: quoteConfig,
    Rating: ratingConfig,
    Countdown: countdownConfig,
    EmbedHtml: embedHtmlConfig,
    Table: tableConfig,
    Accordion: accordionConfig,
    AccordionItem: accordionItemConfig,
    Tabs: tabsConfig,
    Tab: tabConfig,
    Banner: bannerConfig,
    Button: buttonConfig,
    FeatureGrid: featureGridConfig,
    Feature: featureConfig,
    SearchBox: searchBoxConfig,
    VideoEmbed: videoEmbedConfig,
    MapEmbed: mapEmbedConfig,
    ImageSlider: imageSliderConfig,
    BeforeAfter: beforeAfterConfig,
    LogoStrip: logoStripConfig,
    Testimonials: testimonialsConfig,
    Testimonial: testimonialConfig,
    Team: teamConfig,
    TeamMember: teamMemberConfig,
    PricingTable: pricingTableConfig,
    PricingPlan: pricingPlanConfig,
    StatsCounter: statsCounterConfig,
    Stat: statConfig,
    Timeline: timelineConfig,
    TimelineStep: timelineStepConfig,
  },
};
