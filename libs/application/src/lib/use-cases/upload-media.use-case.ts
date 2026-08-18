import { randomUUID } from 'node:crypto';
import { Media } from '@brisk/domain-core';
import type { MediaRepositoryPort, MediaStoragePort } from '@brisk/ports';

export interface UploadMediaDeps {
  mediaRepository: MediaRepositoryPort;
  mediaStorage: MediaStoragePort;
}

export interface UploadMediaInput {
  tenantId: string;
  siteId: string;
  filename: string;
  mimeType: string;
  data: Uint8Array;
}

export async function uploadMedia(
  deps: UploadMediaDeps,
  input: UploadMediaInput,
): Promise<Media> {
  const uploaded = await deps.mediaStorage.upload({
    tenantId: input.tenantId,
    siteId: input.siteId,
    filename: input.filename,
    mimeType: input.mimeType,
    data: input.data,
  });

  const media = Media.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: input.siteId,
    filename: input.filename,
    storageKey: uploaded.storageKey,
    storageProvider: deps.mediaStorage.provider,
    mimeType: uploaded.mimeType,
    size: uploaded.size,
    width: uploaded.width,
    height: uploaded.height,
  });

  await deps.mediaRepository.save(media);
  return media;
}
