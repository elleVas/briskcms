import { describe, expect, it } from 'vitest';
import { Form } from './form.js';

describe('Form entity', () => {
  it('create starts with no fields and no notification email', () => {
    const form = Form.create({
      id: 'form-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      name: 'Contattaci',
    });

    expect(form.name).toBe('Contattaci');
    expect(form.fields).toEqual([]);
    expect(form.notificationEmail).toBeNull();
  });

  it('fromProps/toProps round-trip without loss', () => {
    const props = {
      id: 'form-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      name: 'Contattaci',
      fields: [
        { id: 'f1', label: 'Nome', type: 'text' as const, required: true },
      ],
      notificationEmail: 'info@example.com',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    const form = Form.fromProps(props);

    expect(form.toProps()).toEqual(props);
  });

  it('update replaces name, fields, and notification email, bumping updatedAt', () => {
    const form = Form.create({
      id: 'form-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      name: 'Contattaci',
      now: new Date('2026-01-01T00:00:00Z'),
    });

    form.update(
      {
        name: 'Richiedi preventivo',
        fields: [{ id: 'f1', label: 'Email', type: 'email', required: true }],
        notificationEmail: 'preventivi@example.com',
      },
      new Date('2026-01-02T00:00:00Z'),
    );

    expect(form.name).toBe('Richiedi preventivo');
    expect(form.fields).toEqual([
      { id: 'f1', label: 'Email', type: 'email', required: true },
    ]);
    expect(form.notificationEmail).toBe('preventivi@example.com');
    expect(form.updatedAt).toEqual(new Date('2026-01-02T00:00:00Z'));
  });
});
