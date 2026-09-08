import {
  BLOCK_STYLE_DEFAULTS,
  type SocialLinksProps,
} from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const socialLinksBlock: BlockDescriptor<SocialLinksProps> = {
  type: 'SocialLinks',
  label: 'blocks.socialLinks.label',
  category: 'navigation',
  defaultProps: { display: 'grid' },
  fields: [
    {
      kind: 'select',
      key: 'display',
      label: 'blocks.shared.display.fieldLabel',
      options: [
        { label: 'blocks.shared.display.options.grid', value: 'grid' },
        { label: 'blocks.shared.display.options.slider', value: 'slider' },
        { label: 'blocks.shared.display.options.carousel', value: 'carousel' },
      ],
    },
  ],
  isContainer: true,
  allowedChildTypes: ['SocialLink'],
  stylableProperties: [...BlockStyleRegistry.STANDARD, 'gap'],
  defaultStyle: BLOCK_STYLE_DEFAULTS.SocialLinks,
};
