import type { WordPressAnalysis } from '@brisk/shared-types';
import { API_BASE_URL, request } from './http-client';

export type ImportJobStatus = 'analyzing' | 'analyzed' | 'failed';

export interface ImportJobDto {
  id: string;
  siteId: string;
  source: string;
  fileName: string;
  fileBytes: number;
  status: ImportJobStatus;
  /** Present once the reading has finished. */
  report: WordPressAnalysis | null;
  /** Present when it failed, and written to be read by whoever uploaded the file. */
  failureReason: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/**
 * Sends the export and gets back the job that will read it.
 *
 * `fetch` directly rather than `request()`: this one sends a file of up
 * to half a gigabyte, and the JSON client's own timeout is measured for
 * requests that carry a sentence.
 */
export async function startWordPressAnalysis(
  siteId: string,
  file: File,
): Promise<ImportJobDto> {
  const body = new FormData();
  body.append('siteId', siteId);
  body.append('file', file);

  const res = await fetch(`${API_BASE_URL}/imports/wordpress/analysis`, {
    method: 'POST',
    credentials: 'include',
    body,
  });
  if (!res.ok) {
    throw new Error(`Import API error: ${res.status}`);
  }
  return res.json();
}

export function getImportJob(id: string): Promise<ImportJobDto> {
  return request<ImportJobDto>(`/imports/${id}`);
}

export function listImportJobs(
  siteId: string,
): Promise<{ items: ImportJobDto[] }> {
  return request<{ items: ImportJobDto[] }>(
    `/imports?siteId=${encodeURIComponent(siteId)}`,
  );
}
