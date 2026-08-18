import { describe, expect, it } from 'vitest';
import { formFieldSchema, formFieldsSchema } from './form-fields.js';

describe('form-fields schemas', () => {
  it('accepts a valid text field', () => {
    const result = formFieldSchema.safeParse({
      id: 'field-1',
      label: 'Nome',
      type: 'text',
      required: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a select field with options', () => {
    const result = formFieldSchema.safeParse({
      id: 'field-1',
      label: 'Motivo del contatto',
      type: 'select',
      required: false,
      options: ['Informazioni', 'Preventivo', 'Altro'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a field with an empty label', () => {
    const result = formFieldSchema.safeParse({
      id: 'field-1',
      label: '',
      type: 'text',
      required: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown field type', () => {
    const result = formFieldSchema.safeParse({
      id: 'field-1',
      label: 'Allegato',
      type: 'file',
      required: false,
    });
    expect(result.success).toBe(false);
  });

  it('validates an array of fields', () => {
    const result = formFieldsSchema.safeParse([
      { id: 'f1', label: 'Nome', type: 'text', required: true },
      { id: 'f2', label: 'Email', type: 'email', required: true },
      { id: 'f3', label: 'Messaggio', type: 'textarea', required: false },
    ]);
    expect(result.success).toBe(true);
  });
});
