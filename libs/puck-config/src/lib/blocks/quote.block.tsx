import type { ComponentConfig } from '@puckeditor/core';
import { quotePropsSchema, type QuoteProps } from '@brisk/shared-types';

export { quotePropsSchema, type QuoteProps };

export const quoteConfig: ComponentConfig<QuoteProps> = {
  label: 'Citazione',
  fields: {
    quote: { type: 'textarea' },
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
