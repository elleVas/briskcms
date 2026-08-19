import type { ComponentConfig } from '@puckeditor/core';
import { embedHtmlPropsSchema, type EmbedHtmlProps } from '@brisk/shared-types';

export { embedHtmlPropsSchema, type EmbedHtmlProps };

export const embedHtmlConfig: ComponentConfig<EmbedHtmlProps> = {
  label: 'Embed HTML',
  fields: {
    html: { type: 'textarea' },
  },
  defaultProps: {
    html: '',
  },
  // Shows the pasted code as plain (escaped) preview text — never executed
  // in the editor canvas, sanitized or not. The live, sanitized render only
  // exists on the public site (apps/public-site's EmbedHtml.astro).
  render: ({ html }) => (
    <div
      style={{
        border: '1px dashed #d4d4d8',
        borderRadius: 8,
        padding: 12,
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          fontSize: 11,
          fontWeight: 600,
          color: '#71717a',
          textTransform: 'uppercase',
        }}
      >
        Embed HTML
      </p>
      {html ? (
        <pre
          style={{
            margin: 0,
            fontFamily: 'monospace',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
          }}
        >
          {html}
        </pre>
      ) : (
        <p style={{ margin: 0, color: '#71717a' }}>Nessun codice inserito</p>
      )}
    </div>
  ),
};
