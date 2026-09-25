import {
  type FormField,
  type FormRecord,
  type FormStep,
  type FormSubmissionRecord,
  type PaginatedFormSubmissions,
  type PaginatedForms,
  type SubmissionOriginPageRecord,
  formRecordSchema,
  paginatedFormSubmissionsSchema,
  paginatedFormsSchema,
} from '@brisk/shared-types';
import { API_BASE_URL, request } from './http-client';

export type {
  FormRecord,
  FormSubmissionRecord,
  PaginatedFormSubmissions,
  PaginatedForms,
  SubmissionOriginPageRecord,
};

export async function listForms(
  siteId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedForms> {
  const params = new URLSearchParams({
    siteId,
    page: String(page),
    pageSize: String(pageSize),
  });
  return paginatedFormsSchema.parse(
    await request(`/forms?${params.toString()}`),
  );
}

export async function getForm(id: string): Promise<FormRecord> {
  return formRecordSchema.parse(await request(`/forms/${id}`));
}

export interface CreateFormInput {
  siteId: string;
  name: string;
}

export async function createForm(input: CreateFormInput): Promise<FormRecord> {
  return formRecordSchema.parse(
    await request('/forms', { method: 'POST', body: JSON.stringify(input) }),
  );
}

export interface UpdateFormInput {
  name: string;
  fields: FormField[];
  steps: FormStep[];
  notificationEmail: string | null;
}

export async function updateForm(
  id: string,
  input: UpdateFormInput,
): Promise<FormRecord> {
  return formRecordSchema.parse(
    await request(`/forms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export function deleteForm(id: string): Promise<void> {
  return request(`/forms/${id}`, { method: 'DELETE' });
}

export async function listFormSubmissions(
  formId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedFormSubmissions> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return paginatedFormSubmissionsSchema.parse(
    await request(`/forms/${formId}/submissions?${params.toString()}`),
  );
}

/**
 * The CSV export's URL rather than its contents: the browser has to fetch
 * it itself for the download to work — `request()` would parse the body as
 * JSON and there would be nothing left to hand to the user.
 *
 * Session auth is a cookie, so a plain link carries it.
 */
export function formSubmissionsCsvUrl(formId: string): string {
  return `${API_BASE_URL}/forms/${formId}/submissions.csv`;
}
