import type { ComponentConfig, Fields } from '@puckeditor/core';
import {
  STAR_ICON_PATH,
  testimonialPropsSchema,
  type TestimonialProps,
} from '@brisk/shared-types';
import { MediaPickerField } from '../fields/media-picker-field.js';
import { withInlineTextFallback } from '../fields/resolve-inline-text-fallback.js';

export { testimonialPropsSchema, type TestimonialProps };

const STAR_POSITIONS = [1, 2, 3, 4, 5];

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path d={STAR_ICON_PATH} fill={filled ? '#f59e0b' : '#d4d4d8'} />
    </svg>
  );
}

const fields: Fields<TestimonialProps> = {
  quote: { type: 'textarea', contentEditable: true, visible: false },
  // Not contentEditable: same reasoning as quote.block.tsx's own
  // author/role — this block derives its own citation-style layout below,
  // and Puck's inline transform would replace the raw value with a React
  // node before render() runs.
  author: { type: 'text' },
  role: { type: 'text' },
  avatar: {
    type: 'custom',
    render: ({ value, onChange }) => (
      <MediaPickerField value={value} onChange={onChange} />
    ),
  },
  rating: { type: 'number', min: 1, max: 5, step: 1 },
};

export const testimonialConfig: ComponentConfig<TestimonialProps> = {
  label: 'Testimonianza',
  fields,
  resolveFields: (_data, { parent }) => withInlineTextFallback(fields, parent),
  defaultProps: {
    quote: 'Testo della recensione...',
    author: 'Nome Cognome',
    role: '',
    avatar: null,
    rating: 5,
  },
  render: ({ quote, author, role, avatar, rating }) => (
    <div
      style={{
        flex: '0 0 260px',
        border: '1px solid #e4e4e7',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', gap: 2 }}>
        {STAR_POSITIONS.map((position) => (
          <Star key={position} filled={position <= rating} />
        ))}
      </div>
      <blockquote style={{ margin: '8px 0', fontSize: 14 }}>{quote}</blockquote>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {avatar && (
          <img
            src={avatar.url}
            alt=""
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        )}
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{author}</div>
          {role && <div style={{ fontSize: 12, color: '#71717a' }}>{role}</div>}
        </div>
      </div>
    </div>
  ),
};
