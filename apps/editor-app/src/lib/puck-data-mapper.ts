import type { ComponentData, Data } from '@puckeditor/core';
import type { Block } from '@brisk/shared-types';

/**
 * Puck stays isolated here (see docs/adr/0007): this is the only place that
 * translates between Puck's own data format (root/content/zones) and our
 * canonical `Block[]` (with our own `children` nesting). Neither the API,
 * the domain, nor apps/public-site ever see a Puck `Data`/`ComponentData`.
 *
 * Puck's `zones` (nested drop-zones) aren't mapped yet — no MVP block uses
 * them. When the first container-style block is built, that's where zone
 * <-> children translation belongs, not before there's a concrete block to
 * test it against.
 */

export function fromPuckData(data: Data): Block[] {
  return data.content.map(componentToBlock);
}

function componentToBlock(component: ComponentData): Block {
  const { id: _id, ...props } = component.props as { id: string } & Record<
    string,
    unknown
  >;
  return { type: component.type, props };
}

/**
 * Puck's `id` only needs to be unique within a single active editing
 * session (drag/drop tracking, selection) — it isn't part of our stored
 * format, so a fresh one is generated every time a page is loaded into the
 * editor. That's fine: nothing depends on it being stable across sessions.
 */
export function toPuckData(blocks: Block[]): Data {
  return {
    root: { props: {} },
    content: blocks.map(blockToComponent),
  };
}

function blockToComponent(block: Block): ComponentData {
  return {
    type: block.type,
    props: { id: crypto.randomUUID(), ...block.props },
  } as ComponentData;
}
