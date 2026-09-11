import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { useMakeReusableSection } from './use-make-reusable-section';

function descriptor(
  type: string,
  container?: { allowedChildTypes?: string[] },
): BlockDescriptor {
  return {
    type,
    label: type,
    category: 'content',
    defaultProps: {},
    fields: [],
    ...(container ? { isContainer: true, ...container } : {}),
  };
}

const registry = [
  descriptor('Heading'),
  descriptor('Testimonial'),
  descriptor('Container', {}),
  descriptor('Testimonials', { allowedChildTypes: ['Testimonial'] }),
];

const tree: Block[] = [
  { id: 'root-heading', type: 'Heading', props: {} },
  {
    id: 'box',
    type: 'Container',
    props: {},
    children: [{ id: 'boxed-heading', type: 'Heading', props: {} }],
  },
  {
    id: 'testi',
    type: 'Testimonials',
    props: {},
    children: [{ id: 't1', type: 'Testimonial', props: {} }],
  },
];

function offered(selectedId: string, siteId: string | null = 'site-1') {
  const selectedBlock =
    [tree[0], tree[1].children?.[0], tree[2].children?.[0]].find(
      (block) => block?.id === selectedId,
    ) ?? null;
  const { result } = renderHook(() =>
    useMakeReusableSection({
      siteId: siteId ?? undefined,
      selectedBlock,
      localBlocks: tree,
      registry,
      handleReplaceSelected: () => undefined,
    }),
  );
  return result.current !== undefined;
}

/*
 * Turning a block into a section replaces it with a Section instance, in
 * place. Inside a container that only takes one kind of child, that put a
 * Section inside a list of testimonials, or a grid track inside Columns.
 */
describe('useMakeReusableSection', () => {
  it('is offered for a block at the top of the page', () => {
    expect(offered('root-heading')).toBe(true);
  });

  it('is offered inside a container that takes anything', () => {
    expect(offered('boxed-heading')).toBe(true);
  });

  it('is not offered inside a container that may not hold a Section', () => {
    expect(offered('t1')).toBe(false);
  });

  it('is not offered without a site to create the section in', () => {
    expect(offered('root-heading', null)).toBe(false);
  });
});
