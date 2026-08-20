import type { ComponentConfig, Fields } from '@puckeditor/core';
import {
  beforeAfterPropsSchema,
  type BeforeAfterProps,
} from '@brisk/shared-types';
import { MediaPickerField } from '../fields/media-picker-field.js';
import { createResolveFields } from '../fields/resolve-inline-text-fallback.js';

export { beforeAfterPropsSchema, type BeforeAfterProps };

const fields: Fields<BeforeAfterProps> = {
  beforeImage: {
    type: 'custom',
    render: ({ value, onChange }) => (
      <MediaPickerField value={value} onChange={onChange} />
    ),
  },
  afterImage: {
    type: 'custom',
    render: ({ value, onChange }) => (
      <MediaPickerField value={value} onChange={onChange} />
    ),
  },
  beforeLabel: { type: 'text', contentEditable: true, visible: false },
  afterLabel: { type: 'text', contentEditable: true, visible: false },
};

export const beforeAfterConfig: ComponentConfig<BeforeAfterProps> = {
  label: 'Prima/dopo',
  fields,
  resolveFields: createResolveFields(fields),
  defaultProps: {
    beforeImage: null,
    afterImage: null,
    beforeLabel: 'Prima',
    afterLabel: 'Dopo',
  },
  // Canvas preview shows both images side by side, not the real draggable
  // reveal slider — that interaction only exists on apps/public-site
  // (BeforeAfter.astro).
  render: ({ beforeImage, afterImage, beforeLabel, afterLabel }) => {
    if (!beforeImage || !afterImage) {
      return (
        <div
          style={{
            border: '2px dashed #d4d4d8',
            borderRadius: 8,
            padding: 24,
            textAlign: 'center',
            color: '#71717a',
          }}
        >
          Seleziona entrambe le immagini per il confronto prima/dopo
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <img
            src={beforeImage.url}
            alt={beforeLabel}
            style={{
              width: '100%',
              aspectRatio: '4 / 3',
              objectFit: 'cover',
              borderRadius: 4,
            }}
          />
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
            {beforeLabel}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <img
            src={afterImage.url}
            alt={afterLabel}
            style={{
              width: '100%',
              aspectRatio: '4 / 3',
              objectFit: 'cover',
              borderRadius: 4,
            }}
          />
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
            {afterLabel}
          </div>
        </div>
      </div>
    );
  },
};
