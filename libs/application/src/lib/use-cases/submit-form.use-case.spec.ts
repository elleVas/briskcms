import { describe, expect, it } from 'vitest';
import {
  FormNotFoundError,
  InvalidFormSubmissionError,
} from '@brisk/domain-core';
import { createForm } from './create-form.use-case.js';
import { updateForm } from './update-form.use-case.js';
import { getPublicForm } from './get-public-form.use-case.js';
import { submitForm } from './submit-form.use-case.js';
import {
  InMemoryFormRepository,
  InMemoryFormSubmissionRepository,
} from './in-memory-repositories.test-fixture.js';
import { FakeEmailPort } from './fake-email-port.test-fixture.js';

describe('getPublicForm and submitForm', () => {
  const tenantId = 'tenant-1';
  const siteId = 'site-1';

  function setup() {
    const formRepository = new InMemoryFormRepository();
    const formSubmissionRepository = new InMemoryFormSubmissionRepository();
    const emailPort = new FakeEmailPort();
    return { formRepository, formSubmissionRepository, emailPort };
  }

  async function buildFormWithFields(deps: ReturnType<typeof setup>) {
    const form = await createForm(deps, { tenantId, siteId, name: 'Contatti' });
    return updateForm(deps, {
      tenantId,
      formId: form.id,
      name: 'Contatti',
      fields: [
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'note', label: 'Note', type: 'textarea', required: false },
        {
          id: 'consent',
          label: 'Accetto la privacy',
          type: 'checkbox',
          required: true,
        },
      ],
      notificationEmail: 'owner@example.com',
    });
  }

  it('getPublicForm returns fields but never the notification email', async () => {
    const deps = setup();
    const form = await buildFormWithFields(deps);

    const publicForm = await getPublicForm(deps, { tenantId, formId: form.id });

    expect(publicForm.name).toBe('Contatti');
    expect(publicForm.fields).toHaveLength(3);
    expect(publicForm).not.toHaveProperty('notificationEmail');
  });

  it('getPublicForm throws FormNotFoundError for a nonexistent id', async () => {
    const deps = setup();

    await expect(
      getPublicForm(deps, { tenantId, formId: 'does-not-exist' }),
    ).rejects.toThrow(FormNotFoundError);
  });

  it('submitForm saves the submission and sends a notification email', async () => {
    const deps = setup();
    const form = await buildFormWithFields(deps);

    await submitForm(deps, {
      tenantId,
      formId: form.id,
      pageId: 'page-1',
      values: { email: 'visitor@example.com', consent: true },
      honeypot: '',
    });

    expect(deps.formSubmissionRepository.submissions).toHaveLength(1);
    expect(deps.formSubmissionRepository.submissions[0].payload).toEqual({
      email: 'visitor@example.com',
      consent: true,
    });
    expect(deps.emailPort.sentEmails).toHaveLength(1);
    expect(deps.emailPort.sentEmails[0].to).toBe('owner@example.com');
    expect(deps.emailPort.sentEmails[0].html).toContain('visitor@example.com');
  });

  it('submitForm rejects a missing required field', async () => {
    const deps = setup();
    const form = await buildFormWithFields(deps);

    await expect(
      submitForm(deps, {
        tenantId,
        formId: form.id,
        pageId: null,
        values: { consent: true },
        honeypot: '',
      }),
    ).rejects.toThrow(InvalidFormSubmissionError);
    expect(deps.formSubmissionRepository.submissions).toHaveLength(0);
  });

  it('submitForm rejects an unchecked required checkbox', async () => {
    const deps = setup();
    const form = await buildFormWithFields(deps);

    await expect(
      submitForm(deps, {
        tenantId,
        formId: form.id,
        pageId: null,
        values: { email: 'visitor@example.com', consent: false },
        honeypot: '',
      }),
    ).rejects.toThrow(InvalidFormSubmissionError);
  });

  it('submitForm silently accepts a honeypot-filled submission without saving or notifying', async () => {
    const deps = setup();
    const form = await buildFormWithFields(deps);

    await expect(
      submitForm(deps, {
        tenantId,
        formId: form.id,
        pageId: null,
        values: {},
        honeypot: 'i-am-a-bot',
      }),
    ).resolves.not.toThrow();

    expect(deps.formSubmissionRepository.submissions).toHaveLength(0);
    expect(deps.emailPort.sentEmails).toHaveLength(0);
  });

  it('submitForm throws FormNotFoundError for a nonexistent form', async () => {
    const deps = setup();

    await expect(
      submitForm(deps, {
        tenantId,
        formId: 'does-not-exist',
        pageId: null,
        values: {},
        honeypot: '',
      }),
    ).rejects.toThrow(FormNotFoundError);
  });

  it('submitForm does not send an email when the form has no notification address', async () => {
    const deps = setup();
    const form = await createForm(deps, {
      tenantId,
      siteId,
      name: 'Senza notifica',
    });

    await submitForm(deps, {
      tenantId,
      formId: form.id,
      pageId: null,
      values: {},
      honeypot: '',
    });

    expect(deps.formSubmissionRepository.submissions).toHaveLength(1);
    expect(deps.emailPort.sentEmails).toHaveLength(0);
  });
});
