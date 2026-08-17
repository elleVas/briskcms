import { z } from 'zod';
import type { ComponentConfig } from '@puckeditor/core';

export const textPropsSchema = z.object({
  body: z.string(),
});
export type TextProps = z.infer<typeof textPropsSchema>;

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
