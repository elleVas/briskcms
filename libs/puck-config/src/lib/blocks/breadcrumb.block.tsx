import type { ComponentConfig, Fields } from '@puckeditor/core';
import {
  breadcrumbPropsSchema,
  type BreadcrumbProps,
} from '@brisk/shared-types';
import { visibilityField } from '../fields/visibility-field.js';
import { withInlineTextFallback } from '../fields/resolve-inline-text-fallback.js';

export { breadcrumbPropsSchema, type BreadcrumbProps };

const fields: Fields<BreadcrumbProps> = {
  homeLabel: { type: 'text', contentEditable: true, visible: false },
  visibility: visibilityField,
};

// Canvas-only placeholder — the real trail depends on which page a visitor
// is looking at (its ancestors, page hierarchy), a runtime fact never known
// in the editor canvas. Same principle as LanguageSwitcher's placeholder.
export const breadcrumbConfig: ComponentConfig<BreadcrumbProps> = {
  label: 'Breadcrumb',
  fields,
  resolveFields: (_data, { parent }) => withInlineTextFallback(fields, parent),
  defaultProps: {
    homeLabel: 'Home',
    visibility: 'always',
  },
  render: ({ homeLabel }) => (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: 8,
        fontSize: 14,
        color: '#71717a',
      }}
    >
      <span>{homeLabel}</span>
      <span>›</span>
      <span>Categoria</span>
      <span>›</span>
      <span>Pagina corrente</span>
    </div>
  ),
};
