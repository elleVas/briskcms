import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import { accordionPropsSchema, type AccordionProps } from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { accordionPropsSchema, type AccordionProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `AccordionProps` (the domain schema, empty) — same reasoning as
// column.block.tsx's own `ColumnPuckProps`.
export interface AccordionPuckProps {
  children: Slot;
}

const ACCORDION_COLOR = '#7c3aed';

const fields: Fields<AccordionPuckProps> = {
  children: { type: 'slot', allow: ['AccordionItem'] },
};

export const accordionConfig: ComponentConfig<AccordionPuckProps> = {
  label: 'Accordion/FAQ',
  fields,
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <EditorChrome label="Accordion/FAQ" color={ACCORDION_COLOR}>
      <Children />
    </EditorChrome>
  ),
};
