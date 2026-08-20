import { describe, expect, it } from 'vitest';
import {
  formFieldFileValueSchema,
  formFieldSchema,
  formFieldsSchema,
} from './form-fields.js';

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

  it('accepts a newsletter-consent field', () => {
    const result = formFieldSchema.safeParse({
      id: 'field-1',
      label: 'Iscrivimi alla newsletter',
      type: 'newsletter-consent',
      required: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a file field', () => {
    const result = formFieldSchema.safeParse({
      id: 'field-1',
      label: 'Curriculum',
      type: 'file',
      required: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts date and time fields', () => {
    expect(
      formFieldSchema.safeParse({
        id: 'field-1',
        label: 'Data preferita',
        type: 'date',
        required: false,
      }).success,
    ).toBe(true);
    expect(
      formFieldSchema.safeParse({
        id: 'field-2',
        label: 'Ora preferita',
        type: 'time',
        required: false,
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown field type', () => {
    const result = formFieldSchema.safeParse({
      id: 'field-1',
      label: 'Allegato',
      type: 'attachment',
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

describe('formFieldFileValueSchema', () => {
  it('accepts a valid uploaded-file value', () => {
    const result = formFieldFileValueSchema.safeParse({
      url: 'http://localhost:3000/api/uploads/attachments/abc.pdf',
      filename: 'cv.pdf',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a value missing the filename', () => {
    const result = formFieldFileValueSchema.safeParse({
      url: 'http://localhost:3000/api/uploads/attachments/abc.pdf',
    });
    expect(result.success).toBe(false);
  });
});
