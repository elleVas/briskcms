import type { ComponentConfig, Fields } from '@puckeditor/core';
import { textPropsSchema, type TextProps } from '@brisk/shared-types';
import { withInlineTextFallback } from '../fields/resolve-inline-text-fallback.js';

export { textPropsSchema, type TextProps };

// `contentEditable: true` moves editing onto the canvas (Puck's built-in
// InlineTextField transform) instead of the sidebar's cramped textarea —
// see docs/adr/00xx.
const fields: Fields<TextProps> = {
  body: { type: 'textarea', contentEditable: true, visible: false },
};

export const textConfig: ComponentConfig<TextProps> = {
  label: 'Testo',
  fields,
  resolveFields: (_data, { parent }) => withInlineTextFallback(fields, parent),
  defaultProps: {
    body: 'Testo del blocco...',
  },
  render: ({ body }) => <p>{body}</p>,
};
