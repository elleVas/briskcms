import type { EmbedHtmlProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';

export const embedHtmlBlock: BlockDescriptor<EmbedHtmlProps> = {
  type: 'EmbedHtml',
  label: 'blocks.embedHtml.label',
  category: 'content',
  defaultProps: {
    html: '',
  },
  fields: [
    {
      kind: 'textarea',
      key: 'html',
      label: 'blocks.embedHtml.fields.html.fieldLabel',
    },
  ],
  // Niente textColor: il contenuto è HTML arbitrario incollato dall'utente,
  // che spesso porta già il proprio colore — solo lo spazio "cornice"
  // (sfondo/angoli/padding) ha senso qui.
  stylableProperties: [
    'backgroundColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.EmbedHtml,
};
