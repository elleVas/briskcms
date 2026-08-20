import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeatureListField } from './feature-list-field.js';

describe('FeatureListField', () => {
  it('joins the value array into newline-separated textarea content', () => {
    render(
      <FeatureListField
        value={['Prima riga', 'Seconda riga']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('textbox')).toHaveProperty(
      'value',
      'Prima riga\nSeconda riga',
    );
  });

  it('splits the textarea content back into an array on change', () => {
    const onChange = vi.fn();
    render(<FeatureListField value={[]} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Uno\nDue\nTre' },
    });

    expect(onChange).toHaveBeenCalledWith(['Uno', 'Due', 'Tre']);
  });

  it('renders an empty textarea for an empty list', () => {
    render(<FeatureListField value={[]} onChange={vi.fn()} />);

    expect(screen.getByRole('textbox')).toHaveProperty('value', '');
  });
});
