import type { FormField, FormStep } from '@brisk/shared-types';
import { request } from './http-client';

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
