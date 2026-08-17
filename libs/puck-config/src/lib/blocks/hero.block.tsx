import { z } from 'zod';
import type { ComponentConfig } from '@puckeditor/core';

export const heroPropsSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
});
export type HeroProps = z.infer<typeof heroPropsSchema>;

export const heroConfig: ComponentConfig<HeroProps> = {
  label: 'Hero',
  fields: {
    title: { type: 'text' },
    subtitle: { type: 'textarea' },
  },
  defaultProps: {
    title: 'Titolo',
    subtitle: 'Sottotitolo',
  },
  render: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
};
