import type { ComponentConfig } from '@puckeditor/core';
import { heroPropsSchema, type HeroProps } from '@brisk/shared-types';

export { heroPropsSchema, type HeroProps };

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
