import type { PricingPlanProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';
import { FeatureListField } from '../fields/feature-list-field.js';
import { ctaLinkFields } from '../fields/link-type-field.js';

export const pricingPlanBlock: BlockDescriptor<PricingPlanProps> = {
  type: 'PricingPlan',
  label: 'Piano prezzo',
  category: 'socialProof',
  defaultProps: {
    name: 'Base',
    price: '9€',
    period: '/mese',
    features: ['Caratteristica 1', 'Caratteristica 2'],
    highlighted: false,
    buttonLabel: 'Scegli piano',
    linkType: 'page',
    page: null,
    url: '',
  },
  fields: [
    { kind: 'text', key: 'name', label: 'Nome piano', inlineEditable: true },
    { kind: 'text', key: 'price', label: 'Prezzo', inlineEditable: true },
    { kind: 'text', key: 'period', label: 'Periodo', inlineEditable: true },
    FieldBuilder.custom('features', 'Caratteristiche', FeatureListField),
    // Sostituisce il radio a valori booleani di Puck (options con
    // value: true/false) — un toggle si adatta meglio a un flag binario.
    { kind: 'boolean', key: 'highlighted', label: 'In evidenza' },
    {
      kind: 'text',
      key: 'buttonLabel',
      label: 'Testo bottone',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.PricingPlan,
};
