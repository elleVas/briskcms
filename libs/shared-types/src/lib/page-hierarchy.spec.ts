import { describe, expect, it } from 'vitest';
import { resolveAncestorSlugs, type PageHierarchyNode } from './page-hierarchy';

function nodeMap(nodes: PageHierarchyNode[]): Map<string, PageHierarchyNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

describe('resolveAncestorSlugs', () => {
  it('returns an empty list for a root page (no parentId)', () => {
    const nodes = nodeMap([{ id: 'a', parentId: null, slug: 'servizi' }]);

    expect(resolveAncestorSlugs(nodes, 'a')).toEqual([]);
  });

  it('returns the single parent slug for a one-level-deep page', () => {
    const nodes = nodeMap([
      { id: 'a', parentId: null, slug: 'servizi' },
      { id: 'b', parentId: 'a', slug: 'idraulica' },
    ]);

    expect(resolveAncestorSlugs(nodes, 'b')).toEqual(['servizi']);
  });

  it('orders ancestors root-to-parent for a multi-level chain', () => {
    const nodes = nodeMap([
      { id: 'a', parentId: null, slug: 'home' },
      { id: 'b', parentId: 'a', slug: 'servizi' },
      { id: 'c', parentId: 'b', slug: 'idraulica' },
      { id: 'd', parentId: 'c', slug: 'urgenze' },
    ]);

    expect(resolveAncestorSlugs(nodes, 'd')).toEqual([
      'home',
      'servizi',
      'idraulica',
    ]);
  });

  it('returns an empty list for a page not present in the map at all', () => {
    const nodes = nodeMap([{ id: 'a', parentId: null, slug: 'servizi' }]);

    expect(resolveAncestorSlugs(nodes, 'missing')).toEqual([]);
  });

  it('stops walking (without throwing) when a parentId points outside the map', () => {
    const nodes = nodeMap([{ id: 'b', parentId: 'a', slug: 'idraulica' }]);

    expect(resolveAncestorSlugs(nodes, 'b')).toEqual([]);
  });

  it('terminates instead of looping forever if the data has a cycle', () => {
    const nodes = nodeMap([
      { id: 'a', parentId: 'b', slug: 'a' },
      { id: 'b', parentId: 'a', slug: 'b' },
    ]);

    expect(resolveAncestorSlugs(nodes, 'a')).toHaveLength(20);
  });
});
