import type { Media } from '@brisk/domain-core';
import type {
  MediaRepositoryPort,
  PaginatedResult,
  Pagination,
} from '@brisk/ports';

export interface ListMediaDeps {
  mediaRepository: MediaRepositoryPort;
}

export interface ListMediaInput {
  tenantId: string;
  siteId: string;
  page: number;
  pageSize: number;
}

export function listMedia(
  deps: ListMediaDeps,
  input: ListMediaInput,
): Promise<PaginatedResult<Media>> {
  const pagination: Pagination = { page: input.page, pageSize: input.pageSize };
  return deps.mediaRepository.listBySite(
    input.tenantId,
    input.siteId,
    pagination,
  );
}
