import type { ComponentConfig } from '@puckeditor/core';
import { formBlockPropsSchema, type FormBlockProps } from '@brisk/shared-types';
import { FormPickerField } from '../fields/form-picker-field.js';

export { formBlockPropsSchema, type FormBlockProps };

export const formConfig: ComponentConfig<FormBlockProps> = {
  label: 'Modulo',
  fields: {
    form: {
      type: 'custom',
      render: ({ value, onChange }) => (
        <FormPickerField value={value} onChange={onChange} />
      ),
    },
  },
  defaultProps: {
    form: null,
  },
  // Canvas-only placeholder — the actual fields are never known here (no
  // live fetch in the editor canvas), only the form's cosmetic name
  // (docs/adr/0015: field definitions are live-fetched by apps/public-site
  // at render time, never snapshotted).
  render: ({ form }) => (
    <div
      style={{
        border: '2px dashed #d4d4d8',
        borderRadius: 8,
        padding: 24,
        textAlign: 'center',
        color: '#71717a',
      }}
    >
      {form ? `Modulo: ${form.formName}` : 'Nessun modulo selezionato'}
    </div>
  ),
};
