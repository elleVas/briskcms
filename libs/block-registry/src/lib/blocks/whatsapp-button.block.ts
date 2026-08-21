import type { WhatsAppButtonProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { visibilityField } from '../fields/visibility-field.js';

export const whatsAppButtonBlock: BlockDescriptor<WhatsAppButtonProps> = {
  type: 'WhatsAppButton',
  label: 'Bottone WhatsApp',
  category: 'chrome',
  defaultProps: {
    phoneNumber: '',
    message: '',
    visibility: 'always',
  },
  fields: [
    { kind: 'text', key: 'phoneNumber', label: 'Numero di telefono' },
    { kind: 'text', key: 'message', label: 'Messaggio precompilato' },
    visibilityField,
  ],
};
