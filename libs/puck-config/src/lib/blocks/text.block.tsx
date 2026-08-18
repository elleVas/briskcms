import type { ComponentConfig } from '@puckeditor/core';
import { textPropsSchema, type TextProps } from '@brisk/shared-types';

export { textPropsSchema, type TextProps };

export const textConfig: ComponentConfig<TextProps> = {
  label: 'Testo',
  fields: {
    body: { type: 'textarea' },
  },
  defaultProps: {
    body: 'Testo del blocco...',
  },
  render: ({ body }) => <p>{body}</p>,
};
