import { randomUUID } from 'node:crypto';
import { Collection, CollectionNotFoundError } from '@brisk/domain-core';
import type { CollectionRepositoryPort } from '@brisk/ports';

export interface CollectionDeps {
  collectionRepository: CollectionRepositoryPort;
}

export interface CreateCollectionInput {
  tenantId: string;
  siteId: string;
  name: string;
  icon?: string;
}

/**
 * The four things you can do to a section of the editor, in one file:
 * they are the whole surface, none of them coordinates anything, and a
 * file each would be four files of six lines.
 */
export async function createCollection(
  deps: CollectionDeps,
  input: CreateCollectionInput,
): Promise<Collection> {
  const existing = await deps.collectionRepository.listBySite(
    input.tenantId,
    input.siteId,
  );
  const collection = Collection.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: input.siteId,
    name: input.name,
    icon: input.icon,
    // Appended, not prepended: a new section goes at the bottom of the
    // sidebar, where adding one does not move the entries somebody has
    // learned the position of.
    order: Math.max(-1, ...existing.map((one) => one.order)) + 1,
  });
  await deps.collectionRepository.save(collection);
  return collection;
}

export function listCollections(
  deps: CollectionDeps,
  tenantId: string,
  siteId: string,
): Promise<Collection[]> {
  return deps.collectionRepository.listBySite(tenantId, siteId);
}

export interface UpdateCollectionInput {
  tenantId: string;
  collectionId: string;
  name?: string;
  icon?: string;
}

export async function updateCollection(
  deps: CollectionDeps,
  input: UpdateCollectionInput,
): Promise<Collection> {
  const collection = await deps.collectionRepository.findById(
    input.tenantId,
    input.collectionId,
  );
  if (!collection) {
    throw new CollectionNotFoundError(input.collectionId);
  }
  if (input.name !== undefined) collection.rename(input.name);
  if (input.icon !== undefined) collection.changeIcon(input.icon);
  await deps.collectionRepository.save(collection);
  return collection;
}

/**
 * Removes the section. What it held stays: the column pointing here is
 * `on delete set null`, so its pages become ordinary pages and appear
 * back under Pages. Deleting a shelf is not deleting the books.
 */
export async function deleteCollection(
  deps: CollectionDeps,
  tenantId: string,
  collectionId: string,
): Promise<void> {
  const collection = await deps.collectionRepository.findById(
    tenantId,
    collectionId,
  );
  if (!collection) {
    throw new CollectionNotFoundError(collectionId);
  }
  await deps.collectionRepository.delete(tenantId, collectionId);
}
