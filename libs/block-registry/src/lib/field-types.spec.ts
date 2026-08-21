import { describe, expect, it } from 'vitest';
import { customField } from './field-types.js';

function DummyField({ value }: { value: string | null }) {
  return value;
}

describe('customField', () => {
  it('builds a kind: custom FieldDescriptor carrying the given key/label/component', () => {
    const field = customField('page', 'Pagina', DummyField);

    expect(field.kind).toBe('custom');
    expect(field.key).toBe('page');
    expect(field.label).toBe('Pagina');
    if (field.kind === 'custom') {
      expect(field.component).toBe(DummyField);
    }
  });
});
