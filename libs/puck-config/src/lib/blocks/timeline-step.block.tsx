import type { ComponentConfig, Fields } from '@puckeditor/core';
import {
  timelineStepPropsSchema,
  type TimelineStepProps,
} from '@brisk/shared-types';
import { createResolveFields } from '../fields/resolve-inline-text-fallback.js';

export { timelineStepPropsSchema, type TimelineStepProps };

const fields: Fields<TimelineStepProps> = {
  label: { type: 'text', contentEditable: true, visible: false },
  title: { type: 'text', contentEditable: true, visible: false },
  description: { type: 'textarea', contentEditable: true, visible: false },
};

export const timelineStepConfig: ComponentConfig<TimelineStepProps> = {
  label: 'Fase',
  fields,
  resolveFields: createResolveFields(fields),
  defaultProps: {
    label: 'Fase 1',
    title: 'Titolo della fase',
    description: 'Descrizione della fase...',
  },
  render: ({ label, title, description }) => (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#4338ca',
          marginTop: 6,
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontSize: 12, color: '#71717a' }}>{label}</div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#71717a', marginTop: 2 }}>
          {description}
        </div>
      </div>
    </div>
  ),
};
