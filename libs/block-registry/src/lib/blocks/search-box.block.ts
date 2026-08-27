import type { SearchBoxProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { visibilityField } from '../fields/visibility-field.js';

export const searchBoxBlock: BlockDescriptor<SearchBoxProps> = {
  type: 'SearchBox',
  label: 'blocks.searchBox.label',
  category: 'conversion',
  defaultProps: {
    placeholder: 'Cerca nel sito...',
    visibility: 'always',
  },
  fields: [
    {
      kind: 'text',
      key: 'placeholder',
      label: 'blocks.searchBox.fields.placeholder.fieldLabel',
    },
    visibilityField,
  ],
};
