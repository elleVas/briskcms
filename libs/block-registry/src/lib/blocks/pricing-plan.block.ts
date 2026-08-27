import type { PricingPlanProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';
import { FeatureListField } from '../fields/feature-list-field.js';
import { ctaLinkFields } from '../fields/link-type-field.js';

export const pricingPlanBlock: BlockDescriptor<PricingPlanProps> = {
  type: 'PricingPlan',
  label: 'blocks.pricingPlan.label',
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
    {
      kind: 'text',
      key: 'name',
      label: 'blocks.pricingPlan.fields.name.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'price',
      label: 'blocks.pricingPlan.fields.price.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'period',
      label: 'blocks.pricingPlan.fields.period.fieldLabel',
      inlineEditable: true,
    },
    FieldBuilder.custom(
      'features',
      'blocks.pricingPlan.fields.features.fieldLabel',
      FeatureListField,
    ),
    // Sostituisce il radio a valori booleani di Puck (options con
    // value: true/false) — un toggle si adatta meglio a un flag binario.
    {
      kind: 'boolean',
      key: 'highlighted',
      label: 'blocks.pricingPlan.fields.highlighted.fieldLabel',
    },
    {
      kind: 'text',
      key: 'buttonLabel',
      label: 'blocks.pricingPlan.fields.buttonLabel.fieldLabel',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.PricingPlan,
};
