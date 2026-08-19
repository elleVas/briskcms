import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import {
  featureGridPropsSchema,
  type FeatureGridProps,
} from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { featureGridPropsSchema, type FeatureGridProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `FeatureGridProps` (the domain schema, empty) — same reasoning as
// column.block.tsx's own `ColumnPuckProps`.
export interface FeatureGridPuckProps {
  children: Slot;
}

const FEATURE_GRID_COLOR = '#059669';

const fields: Fields<FeatureGridPuckProps> = {
  children: { type: 'slot', allow: ['Feature'] },
};

export const featureGridConfig: ComponentConfig<FeatureGridPuckProps> = {
  label: 'Feature grid',
  fields,
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <EditorChrome label="Feature grid" color={FEATURE_GRID_COLOR}>
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
