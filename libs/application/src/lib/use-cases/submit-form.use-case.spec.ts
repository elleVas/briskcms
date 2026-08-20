import { describe, expect, it } from 'vitest';
import {
  FormNotFoundError,
  InvalidCaptchaError,
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
import { FakeCaptchaPort } from './fake-captcha-port.test-fixture.js';
import {
  FailingNewsletterPort,
  FakeNewsletterPort,
} from './fake-newsletter-port.test-fixture.js';

describe('getPublicForm and submitForm', () => {
  const tenantId = 'tenant-1';
  const siteId = 'site-1';
  const captchaToken = 'valid-token';

  function setup() {
    const formRepository = new InMemoryFormRepository();
    const formSubmissionRepository = new InMemoryFormSubmissionRepository();
    const emailPort = new FakeEmailPort();
    const captchaPort = new FakeCaptchaPort();
    const newsletterPort = new FakeNewsletterPort();
    return {
      formRepository,
      formSubmissionRepository,
      emailPort,
      captchaPort,
      newsletterPort,
    };
  }

  async function buildFormWithFields(deps: {
    formRepository: InMemoryFormRepository;
  }) {
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
      steps: [],
      notificationEmail: 'owner@example.com',
    });
  }

  async function buildFormWithNewsletterField(deps: {
    formRepository: InMemoryFormRepository;
  }) {
    const form = await createForm(deps, { tenantId, siteId, name: 'Contatti' });
    return updateForm(deps, {
      tenantId,
      formId: form.id,
      name: 'Contatti',
      fields: [
        { id: 'email', label: 'Email', type: 'email', required: true },
        {
          id: 'newsletter',
          label: 'Iscrivimi alla newsletter',
          type: 'newsletter-consent',
          required: false,
        },
      ],
      steps: [],
      notificationEmail: null,
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
      captchaToken,
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

  it('submitForm formats a file field as its filename and URL in the notification email', async () => {
    const deps = setup();
    const form = await createForm(deps, {
      tenantId,
      siteId,
      name: 'Candidature',
    });
    await updateForm(deps, {
      tenantId,
      formId: form.id,
      name: 'Candidature',
      fields: [
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'cv', label: 'Curriculum', type: 'file', required: false },
      ],
      steps: [],
      notificationEmail: 'hr@example.com',
    });

    await submitForm(deps, {
      tenantId,
      formId: form.id,
      pageId: null,
      values: {
        email: 'candidato@example.com',
        cv: {
          url: 'http://localhost:3000/api/uploads/attachments/abc.pdf',
          filename: 'cv.pdf',
        },
      },
      honeypot: '',
      captchaToken,
    });

    expect(deps.emailPort.sentEmails[0].html).toContain('cv.pdf');
    expect(deps.emailPort.sentEmails[0].html).toContain(
      'http://localhost:3000/api/uploads/attachments/abc.pdf',
    );
  });

  it('submitForm shows a dash for a file field left empty in the notification email', async () => {
    const deps = setup();
    const form = await createForm(deps, {
      tenantId,
      siteId,
      name: 'Candidature',
    });
    await updateForm(deps, {
      tenantId,
      formId: form.id,
      name: 'Candidature',
      fields: [
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'cv', label: 'Curriculum', type: 'file', required: false },
      ],
      steps: [],
      notificationEmail: 'hr@example.com',
    });

    await submitForm(deps, {
      tenantId,
      formId: form.id,
      pageId: null,
      values: { email: 'candidato@example.com', cv: '' },
      honeypot: '',
      captchaToken,
    });

    expect(deps.emailPort.sentEmails[0].html).not.toContain('[object Object]');
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
        captchaToken,
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
        captchaToken,
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
        // Deliberately blank: the honeypot short-circuit (docs/adr/0015)
        // must return before the CAPTCHA check ever runs, so an invalid
        // token here must not turn into a visible InvalidCaptchaError.
        captchaToken: '',
      }),
    ).resolves.not.toThrow();

    expect(deps.formSubmissionRepository.submissions).toHaveLength(0);
    expect(deps.emailPort.sentEmails).toHaveLength(0);
  });

  it('submitForm rejects an invalid or missing CAPTCHA token', async () => {
    const deps = setup();
    const form = await buildFormWithFields(deps);

    await expect(
      submitForm(deps, {
        tenantId,
        formId: form.id,
        pageId: null,
        values: { email: 'visitor@example.com', consent: true },
        honeypot: '',
        captchaToken: '',
      }),
    ).rejects.toThrow(InvalidCaptchaError);
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
        captchaToken,
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
      captchaToken,
    });

    expect(deps.formSubmissionRepository.submissions).toHaveLength(1);
    expect(deps.emailPort.sentEmails).toHaveLength(0);
  });

  it('submitForm subscribes the submitted email when the newsletter-consent field is checked', async () => {
    const deps = setup();
    const form = await buildFormWithNewsletterField(deps);

    await submitForm(deps, {
      tenantId,
      formId: form.id,
      pageId: null,
      values: { email: 'visitor@example.com', newsletter: true },
      honeypot: '',
      captchaToken,
    });

    expect(deps.newsletterPort.subscribedEmails).toEqual([
      'visitor@example.com',
    ]);
  });

  it('submitForm does not subscribe when the newsletter-consent field is left unchecked', async () => {
    const deps = setup();
    const form = await buildFormWithNewsletterField(deps);

    await submitForm(deps, {
      tenantId,
      formId: form.id,
      pageId: null,
      values: { email: 'visitor@example.com', newsletter: false },
      honeypot: '',
      captchaToken,
    });

    expect(deps.newsletterPort.subscribedEmails).toHaveLength(0);
  });

  it('submitForm still saves the submission even if the newsletter provider fails', async () => {
    const deps = { ...setup(), newsletterPort: new FailingNewsletterPort() };
    const form = await buildFormWithNewsletterField(deps);

    await expect(
      submitForm(deps, {
        tenantId,
        formId: form.id,
        pageId: null,
        values: { email: 'visitor@example.com', newsletter: true },
        honeypot: '',
        captchaToken,
      }),
    ).resolves.not.toThrow();

    expect(deps.formSubmissionRepository.submissions).toHaveLength(1);
  });
});
