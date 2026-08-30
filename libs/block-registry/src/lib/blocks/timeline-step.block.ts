import type { TimelineStepProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';

export const timelineStepBlock: BlockDescriptor<TimelineStepProps> = {
  type: 'TimelineStep',
  label: 'blocks.timelineStep.label',
  category: 'socialProof',
  defaultProps: {
    label: 'Fase 1',
    title: 'Titolo della fase',
    description: 'Descrizione della fase...',
  },
  fields: [
    {
      kind: 'text',
      key: 'label',
      label: 'blocks.timelineStep.fields.label.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'title',
      label: 'blocks.timelineStep.fields.title.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'textarea',
      key: 'description',
      label: 'blocks.timelineStep.fields.description.fieldLabel',
      inlineEditable: true,
    },
  ],
};
