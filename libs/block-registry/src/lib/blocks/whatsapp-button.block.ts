import type { WhatsAppButtonProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { visibilityField } from '../fields/visibility-field';

export const whatsAppButtonBlock: BlockDescriptor<WhatsAppButtonProps> = {
  type: 'WhatsAppButton',
  label: 'blocks.whatsAppButton.label',
  category: 'chrome',
  defaultProps: {
    phoneNumber: '',
    message: '',
    visibility: 'always',
  },
  fields: [
    {
      kind: 'text',
      key: 'phoneNumber',
      label: 'blocks.whatsAppButton.fields.phoneNumber.fieldLabel',
    },
    {
      kind: 'text',
      key: 'message',
      label: 'blocks.whatsAppButton.fields.message.fieldLabel',
    },
    visibilityField,
  ],
};
