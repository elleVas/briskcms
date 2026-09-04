import type { FormField, FormStep } from '@brisk/shared-types';
import { API_BASE_URL, request } from './http-client';

export interface FormDto {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  fields: FormField[];
  steps: FormStep[];
  notificationEmail: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * How many submissions this form has received. Sent with the list rather
   * than fetched per row: the list is where someone finds out that answers
   * arrived at all, and without it they would have to open every form to
   * know.
   */
  submissionCount: number;
}

export interface PaginatedForms {
  items: FormDto[];
  total: number;
}

export function listForms(
  siteId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedForms> {
  const params = new URLSearchParams({
    siteId,
    page: String(page),
    pageSize: String(pageSize),
  });
  return request(`/forms?${params.toString()}`);
}

export function getForm(id: string): Promise<FormDto> {
  return request(`/forms/${id}`);
}

export interface CreateFormInput {
  siteId: string;
  name: string;
}

export function createForm(input: CreateFormInput): Promise<FormDto> {
  return request('/forms', { method: 'POST', body: JSON.stringify(input) });
}

export interface UpdateFormInput {
  name: string;
  fields: FormField[];
  steps: FormStep[];
  notificationEmail: string | null;
}

export function updateForm(
  id: string,
  input: UpdateFormInput,
): Promise<FormDto> {
  return request(`/forms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteForm(id: string): Promise<void> {
  return request(`/forms/${id}`, { method: 'DELETE' });
}

export interface FormSubmissionDto {
  id: string;
  /** Keyed by field id — see FormField.id's own comment for why that is stable. */
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedFormSubmissions {
  items: FormSubmissionDto[];
  total: number;
  /**
   * The form's fields as they stand now, sent with the page because a
   * payload keyed by field id cannot be rendered without them. A key not
   * in here is an answer to a field that has since been removed — still a
   * real answer, and still shown.
   */
  fields: FormField[];
}

export function listFormSubmissions(
  formId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedFormSubmissions> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return request<PaginatedFormSubmissions>(
    `/forms/${formId}/submissions?${params.toString()}`,
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
