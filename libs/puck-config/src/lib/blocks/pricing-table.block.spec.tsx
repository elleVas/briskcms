import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PuckContext } from '@puckeditor/core';
import {
  pricingTableConfig,
  pricingTablePropsSchema,
} from './pricing-table.block.js';

const puckContext: PuckContext = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
};

function SlotContent() {
  return <span>Contenuto annidato</span>;
}

describe('pricingTablePropsSchema', () => {
  it('accepts an empty object (no props of its own)', () => {
    const result = pricingTablePropsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown extra props (strict object)', () => {
    const result = pricingTablePropsSchema.safeParse({ extra: 'x' });
    expect(result.success).toBe(false);
  });
});

describe('pricingTableConfig.render', () => {
  it('renders its slot content so the placed PricingPlan blocks are visible and editable', () => {
    render(
      pricingTableConfig.render({
        id: 'test-id',
        children: SlotContent,
        puck: puckContext,
      }),
    );

    expect(screen.getByText('Contenuto annidato')).toBeTruthy();
  });
});
