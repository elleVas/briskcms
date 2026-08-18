import type { Config } from '@puckeditor/core';
import { formConfig, type FormBlockProps } from './blocks/form.block.js';
import { galleryConfig, type GalleryProps } from './blocks/gallery.block.js';
import { heroConfig, type HeroProps } from './blocks/hero.block.js';
import { imageConfig, type ImageProps } from './blocks/image.block.js';
import { textConfig, type TextProps } from './blocks/text.block.js';

export interface BriskComponentProps {
  Hero: HeroProps;
  Text: TextProps;
  Image: ImageProps;
  Gallery: GalleryProps;
  Form: FormBlockProps;
}

export const puckConfig: Config<BriskComponentProps> = {
  components: {
    Hero: heroConfig,
    Text: textConfig,
    Image: imageConfig,
    Gallery: galleryConfig,
    Form: formConfig,
  },
};
