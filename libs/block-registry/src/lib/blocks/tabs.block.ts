import type { TabsProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const tabsBlock: BlockDescriptor<TabsProps> = {
  type: 'Tabs',
  label: 'blocks.tabs.label',
  category: 'interactive',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['Tab'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Tabs,
};
