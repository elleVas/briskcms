import type { ColumnProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

// No allowedChildTypes — a Column is meant to hold whatever the page
// needs side by side with its siblings, same reason as the Container.
export const columnBlock: BlockDescriptor<ColumnProps> = {
  type: 'Column',
  label: 'blocks.column.label',
  category: 'layout',
  defaultProps: {},
  fields: [],
  isContainer: true,
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Column,
};
