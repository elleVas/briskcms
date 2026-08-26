import { describe, expect, it } from 'vitest';
import { FieldBuilder } from './field-types.js';

function DummyField({ value }: { value: string | null }) {
  return value;
}

describe('FieldBuilder.custom', () => {
  it('builds a kind: custom FieldDescriptor carrying the given key/label/component', () => {
    const field = FieldBuilder.custom('page', 'Pagina', DummyField);

    expect(field.kind).toBe('custom');
    expect(field.key).toBe('page');
    expect(field.label).toBe('Pagina');
    if (field.kind === 'custom') {
      expect(field.component).toBe(DummyField);
    }
  });
});
