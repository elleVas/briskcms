import { describe, expect, it } from 'vitest';
import type { BlockDescriptor } from '@brisk/block-sdk';
import { pageBlocks } from './config';
import { headerFooterBlocks } from './layout-config';

/**
 * Where a block may sit is declared from both ends: a container lists what
 * it takes (`allowedChildTypes`), a child lists where it belongs
 * (`allowedParentTypes`). A child naming a parent that would refuse it — or
 * a parent that is not there — is a block nobody can ever insert, and
 * nothing at runtime would say why.
 */
describe.each([
  ['page', pageBlocks],
  ['header and footer', headerFooterBlocks],
] as const)('placement rules of the %s registry', (_name, registry) => {
  const byType = new Map<string, BlockDescriptor>(
    registry.map((descriptor) => [descriptor.type, descriptor]),
  );

  it('names only parents that exist, are containers and take the child', () => {
    const problems = registry.flatMap((child) =>
      (child.allowedParentTypes ?? []).flatMap((parentType) => {
        const parent = byType.get(parentType);
        if (!parent) {
          return [`${child.type}: parent ${parentType} is not registered`];
        }
        if (!parent.isContainer) {
          return [`${child.type}: parent ${parentType} is not a container`];
        }
        if (
          parent.allowedChildTypes &&
          !parent.allowedChildTypes.includes(child.type)
        ) {
          return [`${child.type}: ${parentType} does not list it as a child`];
        }
        return [];
      }),
    );

    expect(problems).toEqual([]);
  });
});

describe('blocks that only work inside their parent', () => {
  it('are exactly the ones that break outside it', () => {
    const declared = Object.fromEntries(
      pageBlocks
        .filter((descriptor) => descriptor.allowedParentTypes)
        .map((descriptor) => [descriptor.type, descriptor.allowedParentTypes]),
    );

    // Checked by rendering each child at the page root (2026-09-11): a Tab
    // has no tab to reach it, a Column is a box with no grid, a timeline
    // step's marker hangs outside the content column. The others render as
    // cards of their own and stay free on purpose.
    expect(declared).toEqual({
      Column: ['Columns'],
      Tab: ['Tabs'],
      TimelineStep: ['Timeline'],
    });
  });
});
