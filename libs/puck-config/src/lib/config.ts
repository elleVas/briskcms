import type { Config } from '@puckeditor/core';
import { heroConfig, type HeroProps } from './blocks/hero.block.js';
import { textConfig, type TextProps } from './blocks/text.block.js';

export interface BriskComponentProps {
  Hero: HeroProps;
  Text: TextProps;
}

export const puckConfig: Config<BriskComponentProps> = {
  components: {
    Hero: heroConfig,
    Text: textConfig,
  },
};
