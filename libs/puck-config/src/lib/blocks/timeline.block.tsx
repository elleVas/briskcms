import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import { timelinePropsSchema, type TimelineProps } from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { timelinePropsSchema, type TimelineProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `TimelineProps` (the domain schema, empty) — same reasoning as
// column.block.tsx's own `ColumnPuckProps`.
export interface TimelinePuckProps {
  children: Slot;
}

const TIMELINE_COLOR = '#4338ca';

const fields: Fields<TimelinePuckProps> = {
  children: { type: 'slot', allow: ['TimelineStep'] },
};

export const timelineConfig: ComponentConfig<TimelinePuckProps> = {
  label: 'Timeline/processo',
  fields,
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <EditorChrome label="Timeline/processo" color={TIMELINE_COLOR}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Children />
      </div>
    </EditorChrome>
  ),
};
