import type { EmbedHtmlProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const embedHtmlBlock: BlockDescriptor<EmbedHtmlProps> = {
  type: 'EmbedHtml',
  label: 'Embed HTML',
  category: 'content',
  defaultProps: {
    html: '',
  },
  fields: [{ kind: 'textarea', key: 'html', label: 'Codice HTML' }],
};
