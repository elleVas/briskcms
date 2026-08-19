import type { ComponentConfig, Fields } from '@puckeditor/core';
import { searchBoxPropsSchema, type SearchBoxProps } from '@brisk/shared-types';
import { visibilityField } from '../fields/visibility-field.js';

export { searchBoxPropsSchema, type SearchBoxProps };

const fields: Fields<SearchBoxProps> = {
  placeholder: { type: 'text' },
  visibility: visibilityField,
};

// Canvas-only placeholder — the real form needs `locale` to build its
// `action` (`/{locale}/search`), a runtime fact never known in the editor
// canvas. Same principle as Breadcrumb/LanguageSwitcher's placeholders.
export const searchBoxConfig: ComponentConfig<SearchBoxProps> = {
  label: 'Ricerca sul sito',
  fields,
  defaultProps: {
    placeholder: 'Cerca nel sito...',
    visibility: 'always',
  },
  render: ({ placeholder }) => (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: 8,
        border: '2px dashed #d4d4d8',
        borderRadius: 8,
      }}
    >
      <input
        type="text"
        placeholder={placeholder}
        disabled
        style={{ flex: 1, padding: '4px 8px' }}
      />
      <button type="button" disabled>
        Cerca
      </button>
    </div>
  ),
};
