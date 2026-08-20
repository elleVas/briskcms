import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomField, PuckContext } from '@puckeditor/core';
import type { PickedPage } from '@brisk/shared-types';
import { PageListContext } from '../page-list-context.js';
import {
  pricingPlanConfig,
  pricingPlanPropsSchema,
} from './pricing-plan.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

describe('pricingPlanPropsSchema', () => {
  it('accepts a page-typed link with a feature list', () => {
    const result = pricingPlanPropsSchema.safeParse({
      name: 'Pro',
      price: '29€',
      period: '/mese',
      features: ['Utenti illimitati', 'Supporto prioritario'],
      highlighted: true,
      buttonLabel: 'Scegli',
      linkType: 'page',
      page: {
        pageId: 'page-1',
        locale: 'it',
        slug: 'contatti',
        title: 'Contatti',
      },
      url: '',
    });
    expect(result.success).toBe(true);
  });

  it('defaults highlighted to false when omitted', () => {
    const result = pricingPlanPropsSchema.parse({
      name: 'Base',
      price: '9€',
      period: '/mese',
      features: [],
      buttonLabel: 'Scegli',
      linkType: 'url',
      page: null,
      url: 'https://example.com',
    });
    expect(result.highlighted).toBe(false);
  });

  it('rejects an unknown linkType', () => {
    const result = pricingPlanPropsSchema.safeParse({
      name: 'Base',
      price: '9€',
      period: '/mese',
      features: [],
      highlighted: false,
      buttonLabel: 'Scegli',
      linkType: 'email',
      page: null,
      url: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('pricingPlanConfig.render', () => {
  it('renders name, price, period and every feature line', () => {
    render(
      pricingPlanConfig.render({
        id: 'test-id',
        name: 'Pro',
        price: '29€',
        period: '/mese',
        features: ['Utenti illimitati', 'Supporto prioritario'],
        highlighted: false,
        buttonLabel: 'Scegli',
        linkType: 'url',
        page: null,
        url: 'https://example.com',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Pro')).toBeTruthy();
    expect(screen.getByText('29€')).toBeTruthy();
    expect(screen.getByText('Utenti illimitati')).toBeTruthy();
    expect(screen.getByText('Supporto prioritario')).toBeTruthy();
  });

  it("shows the picked page's title for a page-typed link", () => {
    render(
      pricingPlanConfig.render({
        id: 'test-id',
        name: 'Pro',
        price: '29€',
        period: '/mese',
        features: [],
        highlighted: false,
        buttonLabel: 'Scegli',
        linkType: 'page',
        page: {
          pageId: 'page-1',
          locale: 'it',
          slug: 'contatti',
          title: 'Contatti',
        },
        url: '',
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Scegli → Contatti')).toBeTruthy();
  });
});

describe('pricingPlanConfig.fields', () => {
  it('edits name, price and period inline on the canvas', () => {
    expect(pricingPlanConfig.fields?.name).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(pricingPlanConfig.fields?.price).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
    expect(pricingPlanConfig.fields?.period).toMatchObject({
      type: 'text',
      contentEditable: true,
      visible: false,
    });
  });
});

describe('pricingPlanConfig.fields.features', () => {
  it('wires the custom field to FeatureListField', () => {
    const featuresField = pricingPlanConfig.fields?.features as CustomField<
      string[]
    >;
    render(
      featuresField.render({
        field: featuresField,
        name: 'features',
        id: 'test-id',
        value: ['Uno', 'Due'],
        onChange: vi.fn(),
      }),
    );

    expect(screen.getByRole('textbox')).toHaveProperty('value', 'Uno\nDue');
  });
});

describe('pricingPlanConfig.fields.page', () => {
  it('wires the custom field to PagePickerField', () => {
    const pageField = pricingPlanConfig.fields
      ?.page as CustomField<PickedPage | null>;
    render(
      <PageListContext.Provider value={{ pick: vi.fn() }}>
        {pageField.render({
          field: pageField,
          name: 'page',
          id: 'test-id',
          value: null,
          onChange: vi.fn(),
        })}
      </PageListContext.Provider>,
    );

    expect(screen.getByText('Scegli pagina')).toBeTruthy();
  });
});
