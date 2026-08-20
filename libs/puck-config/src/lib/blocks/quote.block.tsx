import type { ComponentConfig } from '@puckeditor/core';
import { quotePropsSchema, type QuoteProps } from '@brisk/shared-types';

export { quotePropsSchema, type QuoteProps };

export const quoteConfig: ComponentConfig<QuoteProps> = {
  label: 'Citazione',
  fields: {
    quote: { type: 'textarea', contentEditable: true, visible: false },
    // Not contentEditable: author/role are joined into one derived
    // `citation` string below, not rendered as their own JSX expression —
    // Puck's inline transform replaces a field's value with a React node
    // before render() runs, which would break `.filter(Boolean).join(...)`.
    author: { type: 'text' },
    role: { type: 'text' },
  },
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
