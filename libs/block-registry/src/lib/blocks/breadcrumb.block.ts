import type { BreadcrumbProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { visibilityField } from '../fields/visibility-field.js';

export const breadcrumbBlock: BlockDescriptor<BreadcrumbProps> = {
  type: 'Breadcrumb',
  label: 'blocks.breadcrumb.label',
  category: 'chrome',
  defaultProps: {
    homeLabel: 'Home',
    visibility: 'always',
  },
  fields: [
    {
      kind: 'text',
      key: 'homeLabel',
      label: 'blocks.breadcrumb.fields.homeLabel.fieldLabel',
      inlineEditable: true,
    },
    visibilityField,
  ],
};
