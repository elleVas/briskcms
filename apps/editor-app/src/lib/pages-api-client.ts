import type { Block, SeoMeta } from '@brisk/shared-types';

const API_BASE_URL =
  import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000/api';

export interface PageDto {
  id: string;
  tenantId: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  status: 'draft' | 'published';
  content: Block[];
  publishedContent: Block[] | null;
  seoMeta: SeoMeta;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    body: unknown,
  ) {
    super(`API ${status}: ${JSON.stringify(body)}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export function getPage(id: string): Promise<PageDto> {
  return request(`/pages/${id}`);
}

export interface CreatePageInput {
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  seoMeta: SeoMeta;
}

export function createPage(input: CreatePageInput): Promise<PageDto> {
  return request('/pages', { method: 'POST', body: JSON.stringify(input) });
}

export function saveDraft(id: string, content: Block[]): Promise<PageDto> {
  return request(`/pages/${id}/draft`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function publishPage(id: string): Promise<PageDto> {
  return request(`/pages/${id}/publish`, { method: 'POST' });
}

export function login(
  email: string,
  password: string,
): Promise<{ userId: string }> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ success: boolean }> {
  return request('/auth/logout', { method: 'POST' });
}
