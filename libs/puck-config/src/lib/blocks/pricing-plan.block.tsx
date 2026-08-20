import type { ComponentConfig, Fields } from '@puckeditor/core';
import {
  pricingPlanPropsSchema,
  type PricingPlanProps,
} from '@brisk/shared-types';
import { FeatureListField } from '../fields/feature-list-field.js';
import { PagePickerField } from '../fields/page-picker-field.js';

export { pricingPlanPropsSchema, type PricingPlanProps };

// Same "page or url" pattern as NavLink/Banner/PromoBar — both `page` and
// `url` always show up in the sidebar (Puck's `Fields<T>` requires every
// prop key), guided by the `linkType` radio for which one is actually used.
const fields: Fields<PricingPlanProps> = {
  name: { type: 'text', contentEditable: true, visible: false },
  price: { type: 'text', contentEditable: true, visible: false },
  period: { type: 'text', contentEditable: true, visible: false },
  features: {
    type: 'custom',
    render: ({ value, onChange }) => (
      <FeatureListField value={value} onChange={onChange} />
    ),
  },
  highlighted: {
    type: 'radio',
    options: [
      { label: 'In evidenza', value: true },
      { label: 'Normale', value: false },
    ],
  },
  buttonLabel: { type: 'text', contentEditable: true, visible: false },
  linkType: {
    type: 'radio',
    options: [
      { label: 'Pagina del sito', value: 'page' },
      { label: 'URL esterno', value: 'url' },
    ],
  },
  page: {
    type: 'custom',
    render: ({ value, onChange }) => (
      <PagePickerField value={value} onChange={onChange} />
    ),
  },
  url: { type: 'text' },
};

export const pricingPlanConfig: ComponentConfig<PricingPlanProps> = {
  label: 'Piano prezzo',
  fields,
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
  render: ({
    name,
    price,
    period,
    features,
    highlighted,
    buttonLabel,
    linkType,
    page,
  }) => (
    <div
      style={{
        border: highlighted ? '2px solid #ca8a04' : '1px solid #e4e4e7',
        borderRadius: 8,
        padding: 20,
        textAlign: 'center',
      }}
    >
      <div style={{ fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
        {price}
        <span style={{ fontSize: 14, fontWeight: 400 }}>{period}</span>
      </div>
      <ul
        style={{ listStyle: 'none', padding: 0, marginTop: 12, fontSize: 13 }}
      >
        {features.map((feature, index) => (
          <li key={index} style={{ padding: '4px 0' }}>
            {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        style={{
          marginTop: 12,
          padding: '8px 16px',
          borderRadius: 6,
          border: 'none',
          background: '#18181b',
          color: '#fff',
        }}
      >
        {buttonLabel}
        {linkType === 'page' && page ? ` → ${page.title}` : ''}
      </button>
    </div>
  ),
};
