import { describe, expect, it } from 'vitest';
import { FieldBuilder } from './field-types';

describe('FieldBuilder.custom', () => {
  it('builds a kind: custom FieldDescriptor naming the control to render', () => {
    const field = FieldBuilder.custom('page', 'Pagina', 'page');

    expect(field.kind).toBe('custom');
    expect(field.key).toBe('page');
    expect(field.label).toBe('Pagina');
    if (field.kind === 'custom') {
      expect(field.control).toBe('page');
    }
  });

  // The property this whole shape exists for: a descriptor is DATA. It
  // used to hold a live React component, which meant only something
  // running React could read the registry — the API could not tell which
  // fields hold rich text without pulling React into a Node server, and a
  // theme could not declare a custom field at all because the value
  // cannot survive JSON.
  it('produces a field that survives JSON', () => {
    const field = FieldBuilder.custom('media', 'Immagine', 'media');

    expect(JSON.parse(JSON.stringify(field))).toEqual(field);
  });
});
