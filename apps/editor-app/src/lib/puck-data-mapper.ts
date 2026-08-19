import type { ComponentData, Config, Data } from '@puckeditor/core';
import type { Block } from '@brisk/shared-types';

/**
 * Puck stays isolated here (see docs/adr/0007): this is the only place that
 * translates between Puck's own data format (root/content/props-embedded
 * slots) and our canonical `Block[]` (with our own `children` nesting).
 * Neither the API, the domain, nor apps/public-site ever see a Puck
 * `Data`/`ComponentData`.
 *
 * `config` is required (docs/adr/0018): which prop fields are slots is read
 * directly off the `Config` passed in, not a separately maintained map —
 * one less place that could drift out of sync with a block's own field
 * definitions. A block can have at most one slot field today (every
 * container block — Header/Nav/Footer — declares its slot as `children`);
 * `getSlotFieldName` returns the first one it finds if that ever changes.
 */

function getSlotFieldName(config: Config, type: string): string | undefined {
  const fields = config.components[type]?.fields ?? {};
  return Object.entries(fields).find(
    ([, field]) => field?.type === 'slot',
  )?.[0];
}

export function fromPuckData(data: Data, config: Config): Block[] {
  return data.content.map((component) => componentToBlock(component, config));
}

function componentToBlock(component: ComponentData, config: Config): Block {
  const { id: _id, ...rest } = component.props as { id: string } & Record<
    string,
    unknown
  >;
  const slotField = getSlotFieldName(config, component.type);
  if (!slotField) {
    return { type: component.type, props: rest };
  }

  const { [slotField]: slotValue, ...props } = rest;
  const children = ((slotValue as ComponentData[] | undefined) ?? []).map(
    (child) => componentToBlock(child, config),
  );
  return { type: component.type, props, children };
}

/**
 * Puck's `id` only needs to be unique within a single active editing
 * session (drag/drop tracking, selection) — it isn't part of our stored
 * format, so a fresh one is generated every time a page is loaded into the
 * editor. That's fine: nothing depends on it being stable across sessions.
 */
export function toPuckData(blocks: Block[], config: Config): Data {
  return {
    root: { props: {} },
    content: blocks.map((block) => blockToComponent(block, config)),
  };
}

function blockToComponent(block: Block, config: Config): ComponentData {
  const props: Record<string, unknown> = {
    id: crypto.randomUUID(),
    ...block.props,
  };
  const slotField = getSlotFieldName(config, block.type);
  if (slotField) {
    props[slotField] = (block.children ?? []).map((child) =>
      blockToComponent(child, config),
    );
  }
  return { type: block.type, props } as ComponentData;
}
