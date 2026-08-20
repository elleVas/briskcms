import type { ComponentConfig } from '@puckeditor/core';
import {
  newsletterSignupPropsSchema,
  type NewsletterSignupProps,
} from '@brisk/shared-types';

export { newsletterSignupPropsSchema, type NewsletterSignupProps };

export const newsletterSignupConfig: ComponentConfig<NewsletterSignupProps> = {
  label: 'Iscrizione newsletter',
  fields: {
    title: { type: 'text', contentEditable: true, visible: false },
    buttonLabel: { type: 'text', contentEditable: true, visible: false },
  },
  defaultProps: {
    title: 'Iscriviti alla newsletter',
    buttonLabel: 'Iscrivimi',
  },
  // Static preview only — the real email input, honeypot and Turnstile
  // widget only exist on apps/public-site (NewsletterSignup.astro), same
  // split as Form's own canvas placeholder.
  render: ({ title, buttonLabel }) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 320,
      }}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid #d4d4d8',
            borderRadius: 6,
            color: '#a1a1aa',
            fontSize: 14,
          }}
        >
          email@esempio.it
        </div>
        <button
          type="button"
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: '#18181b',
            color: '#fff',
          }}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  ),
};
