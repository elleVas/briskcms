import type { ComponentConfig } from '@puckeditor/core';
import { ratingPropsSchema, type RatingProps } from '@brisk/shared-types';

export { ratingPropsSchema, type RatingProps };

const STAR_PATH =
  'M10 1.5l2.59 5.25 5.79.84-4.19 4.08.99 5.78L10 14.98l-5.18 2.47.99-5.78-4.19-4.08 5.79-.84L10 1.5z';

const STAR_POSITIONS = [1, 2, 3, 4, 5];

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="24" height="24" aria-hidden="true">
      <path d={STAR_PATH} fill={filled ? '#f59e0b' : '#d4d4d8'} />
    </svg>
  );
}

export const ratingConfig: ComponentConfig<RatingProps> = {
  label: 'Valutazione a stelle',
  fields: {
    rating: { type: 'number', min: 1, max: 5, step: 1 },
    label: { type: 'text', contentEditable: true, visible: false },
  },
  defaultProps: {
    rating: 5,
    // Non-empty, unlike before: an inline-editable field needs visible text
    // to click on, same reasoning as every other block's placeholder default.
    label: 'Valutazione clienti',
  },
  render: ({ rating, label }) => (
    <div>
      {label && <p>{label}</p>}
      <div style={{ display: 'flex', gap: 4 }}>
        {STAR_POSITIONS.map((position) => (
          <Star key={position} filled={position <= rating} />
        ))}
      </div>
    </div>
  ),
};
