import type { ContainerProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';

export const containerBlock: BlockDescriptor<ContainerProps> = {
  type: 'Container',
  label: 'blocks.container.label',
  category: 'layout',
  defaultProps: { background: 'none', padding: 'md' },
  fields: [
    {
      kind: 'radio',
      key: 'background',
      label: 'blocks.container.fields.background.fieldLabel',
      options: [
        {
          label: 'blocks.container.fields.background.options.none',
          value: 'none',
        },
        {
          label: 'blocks.container.fields.background.options.muted',
          value: 'muted',
        },
        {
          label: 'blocks.container.fields.background.options.primary',
          value: 'primary',
        },
        {
          label: 'blocks.container.fields.background.options.secondary',
          value: 'secondary',
        },
      ],
    },
    {
      kind: 'radio',
      key: 'padding',
      label: 'blocks.container.fields.padding.fieldLabel',
      options: [
        {
          label: 'blocks.container.fields.padding.options.none',
          value: 'none',
        },
        {
          label: 'blocks.container.fields.padding.options.sm',
          value: 'sm',
        },
        {
          label: 'blocks.container.fields.padding.options.md',
          value: 'md',
        },
        {
          label: 'blocks.container.fields.padding.options.lg',
          value: 'lg',
        },
      ],
    },
  ],
  // No allowedChildTypes — unlike Column (a fixed list for a grid
  // track), a Container is meant to hold anything, including another
  // Container or Columns.
  isContainer: true,
  // Only radius and text color: background/padding already have their
  // own dedicated fields above, they shouldn't be duplicated here.
  stylableProperties: ['textColor', 'borderRadius'],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Container,
};
