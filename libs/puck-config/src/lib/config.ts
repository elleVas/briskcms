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
import { imageConfig, type ImageProps } from './blocks/image.block.js';
import { quoteConfig, type QuoteProps } from './blocks/quote.block.js';
import { ratingConfig, type RatingProps } from './blocks/rating.block.js';
import { tabConfig, type TabPuckProps } from './blocks/tab.block.js';
import { tabsConfig, type TabsPuckProps } from './blocks/tabs.block.js';
import { tableConfig, type TableProps } from './blocks/table.block.js';
import { textConfig, type TextProps } from './blocks/text.block.js';

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
  },
};
