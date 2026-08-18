import { describe, expect, it } from 'vitest';
import type { ComponentData } from '@puckeditor/core';
import type { Block } from '@brisk/shared-types';
import { fromPuckData, toPuckData } from './puck-data-mapper.js';

describe('puck-data-mapper', () => {
  it('round-trips Block[] -> Puck Data -> Block[] unchanged', () => {
    const blocks: Block[] = [
      { type: 'Hero', props: { title: 'Ciao', subtitle: 'Sottotitolo' } },
      { type: 'Text', props: { body: 'Un paragrafo.' } },
    ];

    expect(fromPuckData(toPuckData(blocks))).toEqual(blocks);
  });

  it('handles an empty page', () => {
    expect(fromPuckData(toPuckData([]))).toEqual([]);
  });

  it('gives each component a unique id when converting to Puck Data', () => {
    const blocks: Block[] = [
      { type: 'Text', props: { body: 'uno' } },
      { type: 'Text', props: { body: 'due' } },
    ];

    const ids = toPuckData(blocks).content.map(
      (c: ComponentData) => (c.props as { id: string }).id,
    );

    expect(new Set(ids).size).toBe(2);
  });

  it('strips the injected id back out when converting from Puck Data', () => {
    const data = toPuckData([{ type: 'Text', props: { body: 'x' } }]);

    expect(fromPuckData(data)[0].props).not.toHaveProperty('id');
  });
});
