import type { ComponentConfig, Fields } from '@puckeditor/core';
import { heroPropsSchema, type HeroProps } from '@brisk/shared-types';
import { createResolveFields } from '../fields/resolve-inline-text-fallback.js';

export { heroPropsSchema, type HeroProps };

// `contentEditable: true` moves editing onto the canvas (Puck's built-in
// InlineTextField transform) instead of the sidebar's cramped panel — see
// docs/adr/00xx.
const fields: Fields<HeroProps> = {
  title: { type: 'text', contentEditable: true, visible: false },
  subtitle: { type: 'textarea', contentEditable: true, visible: false },
};

export const heroConfig: ComponentConfig<HeroProps> = {
  label: 'Hero',
  fields,
  resolveFields: createResolveFields(fields),
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
