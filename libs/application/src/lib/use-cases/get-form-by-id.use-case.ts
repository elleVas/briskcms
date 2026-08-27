import { FormNotFoundError, type Form } from '@brisk/domain-core';
import type { FormRepositoryPort } from '@brisk/ports';

export interface GetFormByIdDeps {
  formRepository: FormRepositoryPort;
}

export interface GetFormByIdInput {
  tenantId: string;
  formId: string;
}

/**
 * Security review 2026-08-24, backend seconda passata: FormsController
 * chiamava formRepository.findById direttamente dal controller — l'unico
 * bypass del layer applicativo tra gli endpoint di questo controller,
 * create/update/list passano tutti da uno use-case.
 */
export async function getFormById(
  deps: GetFormByIdDeps,
  input: GetFormByIdInput,
): Promise<Form> {
  const form = await deps.formRepository.findById(input.tenantId, input.formId);
  if (!form) {
    throw new FormNotFoundError(input.formId);
  }
  return form;
}
