import { randomUUID } from 'node:crypto';
import { Form } from '@brisk/domain-core';
import type { FormRepositoryPort } from '@brisk/ports';

export interface CreateFormDeps {
  formRepository: FormRepositoryPort;
}

export interface CreateFormInput {
  tenantId: string;
  siteId: string;
  name: string;
}

export async function createForm(
  deps: CreateFormDeps,
  input: CreateFormInput,
): Promise<Form> {
  const form = Form.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: input.siteId,
    name: input.name,
  });

  await deps.formRepository.save(form);

  return form;
}
