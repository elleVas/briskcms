import type { BreadcrumbProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { visibilityField } from '../fields/visibility-field.js';

export const breadcrumbBlock: BlockDescriptor<BreadcrumbProps> = {
  type: 'Breadcrumb',
  label: 'Breadcrumb',
  category: 'chrome',
  defaultProps: {
    homeLabel: 'Home',
    visibility: 'always',
  },
  fields: [
    {
      kind: 'text',
      key: 'homeLabel',
      label: 'Etichetta home',
      inlineEditable: true,
    },
    visibilityField,
  ],
};
