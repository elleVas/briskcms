import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import { containerPropsSchema, type ContainerProps } from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { containerPropsSchema, type ContainerProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `ContainerProps` (the domain schema) — same reasoning as Columns's own
// `ColumnsPuckProps`. No `allow` list on the slot: unlike Column (fixed
// list of what fits a grid track), a Container is meant to hold anything,
// including another Container or Columns.
export interface ContainerPuckProps extends ContainerProps {
  children: Slot;
}

const CONTAINER_COLOR = '#71717a';

const fields: Fields<ContainerPuckProps> = {
  background: {
    type: 'radio',
    options: [
      { label: 'Nessuno', value: 'none' },
      { label: 'Tenue', value: 'muted' },
      { label: 'Primario', value: 'primary' },
      { label: 'Secondario', value: 'secondary' },
    ],
  },
  padding: {
    type: 'radio',
    options: [
      { label: 'Nessuno', value: 'none' },
      { label: 'Piccolo', value: 'sm' },
      { label: 'Medio', value: 'md' },
      { label: 'Grande', value: 'lg' },
    ],
  },
  children: { type: 'slot' },
};

export const containerConfig: ComponentConfig<ContainerPuckProps> = {
  label: 'Contenitore',
  fields,
  defaultProps: { background: 'none', padding: 'md', children: [] },
  render: ({ background, children: Children }) => (
    <EditorChrome label="Contenitore" color={CONTAINER_COLOR}>
      <Children
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 12,
          background: background === 'none' ? 'transparent' : '#e4e4e7',
          borderRadius: 6,
        }}
      />
    </EditorChrome>
  ),
};
