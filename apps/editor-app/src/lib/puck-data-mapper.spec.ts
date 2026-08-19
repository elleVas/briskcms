import { describe, expect, it } from 'vitest';
import type { ComponentData } from '@puckeditor/core';
import { headerFooterPuckConfig, puckConfig } from '@brisk/puck-config';
import type { Block } from '@brisk/shared-types';
import { fromPuckData, toPuckData } from './puck-data-mapper.js';

describe('puck-data-mapper', () => {
  it('round-trips Block[] -> Puck Data -> Block[] unchanged', () => {
    const blocks: Block[] = [
      { type: 'Hero', props: { title: 'Ciao', subtitle: 'Sottotitolo' } },
      { type: 'Text', props: { body: 'Un paragrafo.' } },
    ];

    expect(fromPuckData(toPuckData(blocks, puckConfig), puckConfig)).toEqual(
      blocks,
    );
  });

  it('handles an empty page', () => {
    expect(fromPuckData(toPuckData([], puckConfig), puckConfig)).toEqual([]);
  });

  it('gives each component a unique id when converting to Puck Data', () => {
    const blocks: Block[] = [
      { type: 'Text', props: { body: 'uno' } },
      { type: 'Text', props: { body: 'due' } },
    ];

    const ids = toPuckData(blocks, puckConfig).content.map(
      (c: ComponentData) => (c.props as { id: string }).id,
    );

    expect(new Set(ids).size).toBe(2);
  });

  it('strips the injected id back out when converting from Puck Data', () => {
    const data = toPuckData(
      [{ type: 'Text', props: { body: 'x' } }],
      puckConfig,
    );

    expect(fromPuckData(data, puckConfig)[0].props).not.toHaveProperty('id');
  });

  it('round-trips a nested slot tree (Nav > NavLink/LanguageSwitcher) — no Header wrapper block', () => {
    const blocks: Block[] = [
      {
        type: 'Nav',
        props: {},
        children: [
          {
            type: 'NavLink',
            props: {
              label: 'Home',
              linkType: 'url',
              page: null,
              url: '/',
              position: 'left',
            },
          },
          { type: 'LanguageSwitcher', props: { position: 'right' } },
        ],
      },
    ];

    expect(
      fromPuckData(
        toPuckData(blocks, headerFooterPuckConfig),
        headerFooterPuckConfig,
      ),
    ).toEqual(blocks);
  });

  it('gives every nested component its own unique id, including inside a slot', () => {
    const blocks: Block[] = [
      {
        type: 'Nav',
        props: {},
        children: [{ type: 'LanguageSwitcher', props: { position: 'left' } }],
      },
    ];

    const data = toPuckData(blocks, headerFooterPuckConfig);
    const navId = (data.content[0].props as { id: string }).id;
    const nestedId = (
      (data.content[0].props as { children: ComponentData[] }).children[0]
        .props as { id: string }
    ).id;

    expect(navId).not.toBe(nestedId);
  });

  it('a container block with an empty slot round-trips to an empty children array', () => {
    const blocks: Block[] = [{ type: 'Nav', props: {}, children: [] }];

    expect(
      fromPuckData(
        toPuckData(blocks, headerFooterPuckConfig),
        headerFooterPuckConfig,
      ),
    ).toEqual(blocks);
  });
});
