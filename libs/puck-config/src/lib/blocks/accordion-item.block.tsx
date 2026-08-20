import type { ComponentConfig } from '@puckeditor/core';
import {
  accordionItemPropsSchema,
  type AccordionItemProps,
} from '@brisk/shared-types';

export { accordionItemPropsSchema, type AccordionItemProps };

export const accordionItemConfig: ComponentConfig<AccordionItemProps> = {
  label: 'Domanda',
  fields: {
    question: { type: 'text', contentEditable: true, visible: false },
    answer: { type: 'textarea', contentEditable: true, visible: false },
  },
  defaultProps: {
    question: 'Domanda...',
    answer: 'Risposta...',
  },
  render: ({ question, answer }) => (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontWeight: 600 }}>{question}</div>
      <div style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>
        {answer}
      </div>
    </div>
  ),
};
