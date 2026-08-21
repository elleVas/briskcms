import type { TimelineStepProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const timelineStepBlock: BlockDescriptor<TimelineStepProps> = {
  type: 'TimelineStep',
  label: 'Fase',
  category: 'socialProof',
  defaultProps: {
    label: 'Fase 1',
    title: 'Titolo della fase',
    description: 'Descrizione della fase...',
  },
  fields: [
    { kind: 'text', key: 'label', label: 'Etichetta', inlineEditable: true },
    { kind: 'text', key: 'title', label: 'Titolo', inlineEditable: true },
    {
      kind: 'textarea',
      key: 'description',
      label: 'Descrizione',
      inlineEditable: true,
    },
  ],
};
