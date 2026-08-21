import type { TabsProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const tabsBlock: BlockDescriptor<TabsProps> = {
  type: 'Tabs',
  label: 'Tabs',
  category: 'interactive',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['Tab'],
};
