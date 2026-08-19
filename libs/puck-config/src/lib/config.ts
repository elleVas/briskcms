import type { Config } from '@puckeditor/core';
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
import { formConfig, type FormBlockProps } from './blocks/form.block.js';
import { galleryConfig, type GalleryProps } from './blocks/gallery.block.js';
import { heroConfig, type HeroProps } from './blocks/hero.block.js';
import { imageConfig, type ImageProps } from './blocks/image.block.js';
import { quoteConfig, type QuoteProps } from './blocks/quote.block.js';
import { ratingConfig, type RatingProps } from './blocks/rating.block.js';
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
  },
};
