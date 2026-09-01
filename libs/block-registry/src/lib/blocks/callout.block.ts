import { defineBlock } from '@brisk/block-sdk';
import { calloutPropsSchema } from '@brisk/shared-types';

/**
 * The worked example for `@brisk/block-sdk` — see libs/block-sdk/README.md.
 * A real, first-party block like any other in this folder, just defined
 * with `defineBlock()` instead of a raw object literal: `defaultProps`
 * below is checked against `calloutPropsSchema` the moment this module
 * loads, so a typo here fails immediately instead of silently at first
 * render.
 */
export const calloutBlock = defineBlock({
  type: 'Callout',
  label: 'blocks.callout.label',
  category: 'content',
  schema: calloutPropsSchema,
  defaultProps: {
    message: 'Your message here',
    tone: 'info',
  },
  fields: [
    {
      kind: 'textarea',
      key: 'message',
      translatable: true,
      label: 'blocks.callout.fields.message.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'select',
      key: 'tone',
      label: 'blocks.callout.fields.tone.fieldLabel',
      options: [
        { label: 'blocks.callout.fields.tone.options.info', value: 'info' },
        {
          label: 'blocks.callout.fields.tone.options.warning',
          value: 'warning',
        },
        {
          label: 'blocks.callout.fields.tone.options.success',
          value: 'success',
        },
      ],
    },
  ],
});
