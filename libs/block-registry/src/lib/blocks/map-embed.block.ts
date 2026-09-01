import type { MapEmbedProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';

export const mapEmbedBlock: BlockDescriptor<MapEmbedProps> = {
  type: 'MapEmbed',
  label: 'blocks.mapEmbed.label',
  category: 'media',
  defaultProps: {
    address: 'Via Roma 1, Milano',
  },
  fields: [
    // Not inlineEditable: the address is never a visible text node in
    // MapEmbed.astro — it only feeds the embedded map URL and the title
    // attribute of its iframe (ConsentGatedEmbed), never the rendered
    // DOM directly.
    {
      kind: 'text',
      key: 'address',
      label: 'blocks.mapEmbed.fields.address.fieldLabel',
    },
  ],
};
