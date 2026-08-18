import { FormNotFoundError, type Form } from '@brisk/domain-core';
import type { FormField } from '@brisk/shared-types';
import type { FormRepositoryPort } from '@brisk/ports';

export interface UpdateFormDeps {
  formRepository: FormRepositoryPort;
}

export interface UpdateFormInput {
  tenantId: string;
  formId: string;
  name: string;
  fields: FormField[];
  notificationEmail: string | null;
}

export async function updateForm(
  deps: UpdateFormDeps,
  input: UpdateFormInput,
): Promise<Form> {
  const form = await deps.formRepository.findById(input.tenantId, input.formId);
  if (!form) {
    throw new FormNotFoundError(input.formId);
  }

  form.update({
    name: input.name,
    fields: input.fields,
    notificationEmail: input.notificationEmail,
  });
  await deps.formRepository.save(form);

  return form;
}
