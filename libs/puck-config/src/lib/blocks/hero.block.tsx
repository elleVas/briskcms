import type { ComponentConfig } from '@puckeditor/core';
import { heroPropsSchema, type HeroProps } from '@brisk/shared-types';

export { heroPropsSchema, type HeroProps };

// `contentEditable: true` moves editing onto the canvas (Puck's built-in
// InlineTextField transform) instead of the sidebar's cramped panel — see
// docs/adr/00xx.
export const heroConfig: ComponentConfig<HeroProps> = {
  label: 'Hero',
  fields: {
    title: { type: 'text', contentEditable: true, visible: false },
    subtitle: { type: 'textarea', contentEditable: true, visible: false },
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
