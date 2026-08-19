import type { ComponentConfig, Fields } from '@puckeditor/core';
import {
  whatsAppButtonPropsSchema,
  type WhatsAppButtonProps,
} from '@brisk/shared-types';
import { visibilityField } from '../fields/visibility-field.js';

export { whatsAppButtonPropsSchema, type WhatsAppButtonProps };

const fields: Fields<WhatsAppButtonProps> = {
  phoneNumber: { type: 'text', label: 'Numero di telefono' },
  message: { type: 'text', label: 'Messaggio precompilato' },
  visibility: visibilityField,
};

// Same green bubble + inline SVG glyph as apps/public-site's
// WhatsAppButton.astro (no external icon library, docs: batch A
// standalone blocks) — `phoneNumber` is echoed next to it purely so the
// block is identifiable at a glance while composing the header/footer.
export const whatsAppButtonConfig: ComponentConfig<WhatsAppButtonProps> = {
  label: 'Bottone WhatsApp',
  fields,
  defaultProps: {
    phoneNumber: '',
    message: '',
    visibility: 'always',
  },
  render: ({ phoneNumber }) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#25d366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="#fff"
          aria-hidden="true"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.35 5.07L2 22l5.06-1.32A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.2 14.27c-.22.62-1.28 1.19-1.77 1.24-.45.05-.9.24-3.02-.63-2.55-1.05-4.2-3.62-4.33-3.79-.13-.17-1.04-1.38-1.04-2.63s.66-1.87.9-2.13c.22-.24.48-.3.65-.3.16 0 .32 0 .46.01.15.01.35-.06.55.42.22.53.73 1.83.8 1.97.07.14.12.3.02.48-.09.18-.14.29-.28.45-.14.16-.29.36-.42.48-.14.13-.28.28-.12.55.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.6-.13.25.09 1.57.74 1.84.87.27.14.45.2.51.32.07.11.07.65-.15 1.27z" />
        </svg>
      </span>
      {phoneNumber && (
        <span style={{ fontSize: 13, color: '#52525b' }}>{phoneNumber}</span>
      )}
    </div>
  ),
};
