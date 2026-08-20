import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import { teamPropsSchema, type TeamProps } from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { teamPropsSchema, type TeamProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `TeamProps` (the domain schema, empty) — same reasoning as
// column.block.tsx's own `ColumnPuckProps`.
export interface TeamPuckProps {
  children: Slot;
}

const TEAM_COLOR = '#0284c7';

const fields: Fields<TeamPuckProps> = {
  children: { type: 'slot', allow: ['TeamMember'] },
};

export const teamConfig: ComponentConfig<TeamPuckProps> = {
  label: 'Team/staff',
  fields,
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <EditorChrome label="Team/staff" color={TEAM_COLOR}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
        }}
      >
        <Children />
      </div>
    </EditorChrome>
  ),
};
