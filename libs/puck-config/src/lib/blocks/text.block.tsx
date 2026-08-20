import type { ComponentConfig } from '@puckeditor/core';
import { textPropsSchema, type TextProps } from '@brisk/shared-types';

export { textPropsSchema, type TextProps };

// `contentEditable: true` moves editing onto the canvas (Puck's built-in
// InlineTextField transform) instead of the sidebar's cramped textarea —
// see docs/adr/00xx.
export const textConfig: ComponentConfig<TextProps> = {
  label: 'Testo',
  fields: {
    body: { type: 'textarea', contentEditable: true, visible: false },
  },
  defaultProps: {
    body: 'Testo del blocco...',
  },
  render: ({ body }) => <p>{body}</p>,
};
