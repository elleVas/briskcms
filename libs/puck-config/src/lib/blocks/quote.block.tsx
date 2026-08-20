import type { ComponentConfig, Fields } from '@puckeditor/core';
import { quotePropsSchema, type QuoteProps } from '@brisk/shared-types';
import { withInlineTextFallback } from '../fields/resolve-inline-text-fallback.js';

export { quotePropsSchema, type QuoteProps };

const fields: Fields<QuoteProps> = {
  quote: { type: 'textarea', contentEditable: true, visible: false },
  // Not contentEditable: author/role are joined into one derived
  // `citation` string below, not rendered as their own JSX expression —
  // Puck's inline transform replaces a field's value with a React node
  // before render() runs, which would break `.filter(Boolean).join(...)`.
  author: { type: 'text' },
  role: { type: 'text' },
};

export const quoteConfig: ComponentConfig<QuoteProps> = {
  label: 'Citazione',
  fields,
  resolveFields: (_data, { parent }) => withInlineTextFallback(fields, parent),
  defaultProps: {
    quote: 'Testo della citazione...',
    author: '',
    role: '',
  },
  render: ({ quote, author, role }) => {
    const citation = [author, role].filter(Boolean).join(' — ');
    return (
      <div>
        <blockquote>{quote}</blockquote>
        {citation && <cite>{citation}</cite>}
      </div>
    );
  },
};
