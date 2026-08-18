import { describe, expect, it } from 'vitest';
import { FormNotFoundError } from '@brisk/domain-core';
import { createForm } from './create-form.use-case.js';
import { updateForm } from './update-form.use-case.js';
import { listForms } from './list-forms.use-case.js';
import { deleteForm } from './delete-form.use-case.js';
import { InMemoryFormRepository } from './in-memory-repositories.test-fixture.js';

describe('form lifecycle: create -> update -> list -> delete', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';
  const siteId = 'site-1';

  function setup() {
    const formRepository = new InMemoryFormRepository();
    return { formRepository };
  }

  it('creates a form with empty fields and no notification email', async () => {
    const deps = setup();

    const form = await createForm(deps, { tenantId, siteId, name: 'Contatti' });

    expect(form.name).toBe('Contatti');
    expect(form.fields).toEqual([]);
    expect(form.notificationEmail).toBeNull();
  });

  it('updates a form with fields and a notification email', async () => {
    const deps = setup();
    const form = await createForm(deps, { tenantId, siteId, name: 'Contatti' });

    const updated = await updateForm(deps, {
      tenantId,
      formId: form.id,
      name: 'Richiedi preventivo',
      fields: [{ id: 'email', label: 'Email', type: 'email', required: true }],
      notificationEmail: 'owner@example.com',
    });

    expect(updated.name).toBe('Richiedi preventivo');
    expect(updated.fields).toHaveLength(1);
    expect(updated.notificationEmail).toBe('owner@example.com');
  });

  it('updateForm throws FormNotFoundError for a nonexistent id', async () => {
    const deps = setup();

    await expect(
      updateForm(deps, {
        tenantId,
        formId: 'does-not-exist',
        name: 'x',
        fields: [],
        notificationEmail: null,
      }),
    ).rejects.toThrow(FormNotFoundError);
  });

  it('updateForm does not touch a different tenant', async () => {
    const deps = setup();
    const form = await createForm(deps, { tenantId, siteId, name: 'Contatti' });

    await expect(
      updateForm(deps, {
        tenantId: otherTenantId,
        formId: form.id,
        name: 'hijacked',
        fields: [],
        notificationEmail: null,
      }),
    ).rejects.toThrow(FormNotFoundError);
  });

  it('listForms paginates and scopes by tenant/site', async () => {
    const deps = setup();
    for (let i = 0; i < 3; i++) {
      await createForm(deps, { tenantId, siteId, name: `Form ${i}` });
    }
    await createForm(deps, {
      tenantId: otherTenantId,
      siteId,
      name: 'non mio',
    });

    const result = await listForms(deps, {
      tenantId,
      siteId,
      page: 1,
      pageSize: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
  });

  it('deleteForm removes the form', async () => {
    const deps = setup();
    const form = await createForm(deps, { tenantId, siteId, name: 'Contatti' });

    await deleteForm(deps, { tenantId, formId: form.id });

    expect(await deps.formRepository.findById(tenantId, form.id)).toBeNull();
  });

  it('deleteForm throws FormNotFoundError for a nonexistent id', async () => {
    const deps = setup();

    await expect(
      deleteForm(deps, { tenantId, formId: 'does-not-exist' }),
    ).rejects.toThrow(FormNotFoundError);
  });

  it('deleteForm does not touch a different tenant', async () => {
    const deps = setup();
    const form = await createForm(deps, { tenantId, siteId, name: 'Contatti' });

    await expect(
      deleteForm(deps, { tenantId: otherTenantId, formId: form.id }),
    ).rejects.toThrow(FormNotFoundError);
    expect(
      await deps.formRepository.findById(tenantId, form.id),
    ).not.toBeNull();
  });
});
