import { BLOCK_STYLE_DEFAULTS, type AudioProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const audioBlock: BlockDescriptor<AudioProps> = {
  type: 'Audio',
  label: 'blocks.audio.label',
  category: 'media',
  defaultProps: { media: null, title: '', loop: false },
  fields: [
    FieldBuilder.custom(
      'media',
      'blocks.audio.fields.media.fieldLabel',
      'media',
    ),
    {
      kind: 'text',
      key: 'title',
      translatable: true,
      label: 'blocks.audio.fields.title.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'boolean',
      key: 'loop',
      label: 'blocks.audio.fields.loop.fieldLabel',
    },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Audio,
};
