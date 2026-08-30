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
    // Non inlineEditable: l'indirizzo non è mai un nodo di testo visibile
    // in MapEmbed.astro — alimenta solo l'URL della mappa incorporata e
    // l'attributo title del suo iframe (ConsentGatedEmbed), mai il DOM
    // renderizzato direttamente.
    {
      kind: 'text',
      key: 'address',
      label: 'blocks.mapEmbed.fields.address.fieldLabel',
    },
  ],
};
