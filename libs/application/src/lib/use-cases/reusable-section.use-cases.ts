import { randomUUID } from 'node:crypto';
import {
  ReusableSection,
  ReusableSectionNameAlreadyExistsError,
  ReusableSectionNotFoundError,
  ReusableSectionVersionNotFoundError,
  type ReusableSectionVersion,
} from '@brisk/domain-core';
import type {
  ExposedFields,
  PageContent,
  ReusableSectionKind,
} from '@brisk/shared-types';
import type {
  ReusableSectionRepositoryPort,
  ReusableSectionVersionRepositoryPort,
} from '@brisk/ports';

export interface ReusableSectionDeps {
  reusableSectionRepository: ReusableSectionRepositoryPort;
  reusableSectionVersionRepository: ReusableSectionVersionRepositoryPort;
}

/**
 * The section CRUD, kept in one file rather than one file per verb.
 *
 * The layout-section use cases are one file each, and that shape earns its
 * keep when each one carries real policy — publishing a page decides what
 * to freeze, creating a translation decides what to copy. These do not:
 * seven of them are load, mutate, save, and the interesting logic
 * (resolution at render, re-indexing on publish) lives in the two modules
 * next to this one that actually hold it. Seven files whose bodies are
 * four lines would spread one small thing over seven places to read.
 */

async function load(
  deps: ReusableSectionDeps,
  tenantId: string,
  id: string,
): Promise<ReusableSection> {
  const section = await deps.reusableSectionRepository.findById(tenantId, id);
  if (!section) {
    throw new ReusableSectionNotFoundError(id);
  }
  return section;
}

/**
 * Every write to the draft also writes a version — the same invariant the
 * pages and the header hold: a save is never a destructive overwrite.
 */
async function saveWithVersion(
  deps: ReusableSectionDeps,
  section: ReusableSection,
  actorUserId: string | null,
): Promise<ReusableSection> {
  await deps.reusableSectionRepository.save(section);
  await deps.reusableSectionVersionRepository.save({
    id: randomUUID(),
    tenantId: section.tenantId,
    reusableSectionId: section.id,
    content: section.content,
    createdBy: actorUserId,
    createdAt: section.updatedAt,
  });
  return section;
}

export interface CreateReusableSectionInput {
  tenantId: string;
  siteId: string;
  name: string;
  kind: ReusableSectionKind;
  /** The blocks it starts from — how "turn this strip into a section" arrives here. */
  content?: PageContent;
  actorUserId: string | null;
}

export async function createReusableSection(
  deps: ReusableSectionDeps,
  input: CreateReusableSectionInput,
): Promise<ReusableSection> {
  // Checked here as well as by the unique constraint, so the person gets
  // "that name is taken" rather than a 500 from a driver error. The
  // constraint stays: this check races, and the database does not.
  const existing = await deps.reusableSectionRepository.listBySite(
    input.tenantId,
    input.siteId,
  );
  if (existing.some((section) => section.name === input.name)) {
    throw new ReusableSectionNameAlreadyExistsError(input.name);
  }

  const section = ReusableSection.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: input.siteId,
    name: input.name,
    kind: input.kind,
    content: input.content,
    createdBy: input.actorUserId,
  });
  return saveWithVersion(deps, section, input.actorUserId);
}

export async function listReusableSections(
  deps: ReusableSectionDeps,
  tenantId: string,
  siteId: string,
): Promise<ReusableSection[]> {
  return deps.reusableSectionRepository.listBySite(tenantId, siteId);
}

export async function getReusableSection(
  deps: ReusableSectionDeps,
  tenantId: string,
  id: string,
): Promise<ReusableSection> {
  return load(deps, tenantId, id);
}

export interface SaveReusableSectionDraftInput {
  tenantId: string;
  id: string;
  content: PageContent;
  actorUserId: string | null;
}

export async function saveReusableSectionDraft(
  deps: ReusableSectionDeps,
  input: SaveReusableSectionDraftInput,
): Promise<ReusableSection> {
  const section = await load(deps, input.tenantId, input.id);
  section.saveDraft(input.content);
  return saveWithVersion(deps, section, input.actorUserId);
}

export interface RenameReusableSectionInput {
  tenantId: string;
  id: string;
  name: string;
}

export async function renameReusableSection(
  deps: ReusableSectionDeps,
  input: RenameReusableSectionInput,
): Promise<ReusableSection> {
  const section = await load(deps, input.tenantId, input.id);
  const siblings = await deps.reusableSectionRepository.listBySite(
    input.tenantId,
    section.siteId,
  );
  if (
    siblings.some(
      (other) => other.id !== section.id && other.name === input.name,
    )
  ) {
    throw new ReusableSectionNameAlreadyExistsError(input.name);
  }
  section.rename(input.name);
  // No version row: a name is not content, so restoring an old version
  // must not silently rename the section back.
  await deps.reusableSectionRepository.save(section);
  return section;
}

export interface SetExposedFieldsInput {
  tenantId: string;
  id: string;
  exposedFields: ExposedFields;
}

export async function setReusableSectionExposedFields(
  deps: ReusableSectionDeps,
  input: SetExposedFieldsInput,
): Promise<ReusableSection> {
  const section = await load(deps, input.tenantId, input.id);
  section.setExposedFields(input.exposedFields);
  // Not versioned and not published, for the reason on the entity: it is a
  // rule about who may edit what, not content, and unlocking one more
  // field should not require republishing the section.
  await deps.reusableSectionRepository.save(section);
  return section;
}

export async function deleteReusableSection(
  deps: ReusableSectionDeps,
  tenantId: string,
  id: string,
): Promise<void> {
  await load(deps, tenantId, id);
  // The pages referencing it are deliberately left alone. Rewriting every
  // page that used a deleted section would be a destructive edit made on
  // the user's behalf, across pages they are not looking at; an instance
  // whose section is gone renders as an empty strip (see
  // `resolveSectionBlocks`) and stays visible in the editor, where it can
  // be removed or pointed at another section on purpose.
  await deps.reusableSectionRepository.delete(tenantId, id);
}

export async function listReusableSectionVersions(
  deps: ReusableSectionDeps,
  tenantId: string,
  id: string,
): Promise<ReusableSectionVersion[]> {
  await load(deps, tenantId, id);
  return deps.reusableSectionVersionRepository.listBySection(tenantId, id);
}

export interface RollbackReusableSectionInput {
  tenantId: string;
  id: string;
  versionId: string;
  actorUserId: string | null;
}

/**
 * Restores the draft to an older version. It does NOT republish — the same
 * invariant the pages and the header hold, and it matters more here: a
 * rollback that published itself would change every page using the section
 * the instant it was clicked.
 */
export async function rollbackReusableSectionToVersion(
  deps: ReusableSectionDeps,
  input: RollbackReusableSectionInput,
): Promise<ReusableSection> {
  const section = await load(deps, input.tenantId, input.id);
  const version = await deps.reusableSectionVersionRepository.findById(
    input.tenantId,
    input.versionId,
  );
  if (!version || version.reusableSectionId !== section.id) {
    throw new ReusableSectionVersionNotFoundError(input.versionId);
  }
  section.restoreContent(version.content);
  return saveWithVersion(deps, section, input.actorUserId);
}
