import type { CodeProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';

// Lista breve e curata (non ogni lingua che Shiki supporta) — stessa
// ragione di columns.block.ts's layout radio: poche opzioni chiare battono
// un elenco esaustivo in un editor di contenuto.
const LANGUAGE_OPTIONS = [
  'typescript',
  'tsx',
  'javascript',
  'bash',
  'json',
  'html',
  'css',
  'plaintext',
] as const;

export const codeBlock: BlockDescriptor<CodeProps> = {
  type: 'Code',
  label: 'blocks.code.label',
  category: 'content',
  defaultProps: { code: '', language: 'typescript' },
  fields: [
    {
      kind: 'textarea',
      key: 'code',
      label: 'blocks.code.fields.code.fieldLabel',
    },
    {
      kind: 'select',
      key: 'language',
      label: 'blocks.code.fields.language.fieldLabel',
      options: LANGUAGE_OPTIONS.map((value) => ({
        label: `blocks.code.fields.language.options.${value}`,
        value,
      })),
    },
  ],
  // Niente textColor: il tema di Shiki (github-dark) imposta già i colori
  // della sintassi, stessa ragione di EmbedHtml per il contenuto libero.
  stylableProperties: [
    'backgroundColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Code,
};
