import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockStyleFields } from './block-style-fields.js';

describe('BlockStyleFields', () => {
  it('renders only the fields listed in properties, in that order', () => {
    render(
      <BlockStyleFields
        properties={['borderRadius', 'backgroundColor']}
        value={{}}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Raggio angoli')).toBeTruthy();
    expect(screen.getByText('Colore di sfondo')).toBeTruthy();
    expect(screen.queryByText('Padding orizzontale')).toBeNull();
    expect(screen.queryByText('Colore testo')).toBeNull();
  });

  it('calls onChange with the updated field, keeping the others untouched', () => {
    const onChange = vi.fn();
    render(
      <BlockStyleFields
        properties={['borderRadius', 'paddingX']}
        value={{ paddingX: '1rem' }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Raggio angoli'), {
      target: { value: '9999px' },
    });

    expect(onChange).toHaveBeenCalledWith({
      paddingX: '1rem',
      borderRadius: '9999px',
    });
  });

  it('clears a length field to null when emptied', () => {
    const onChange = vi.fn();
    render(
      <BlockStyleFields
        properties={['borderRadius']}
        value={{ borderRadius: '6px' }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Raggio angoli'), {
      target: { value: '' },
    });

    expect(onChange).toHaveBeenCalledWith({ borderRadius: null });
  });

  it('updates a color field via the text input inside ColorPickerField', () => {
    const onChange = vi.fn();
    render(
      <BlockStyleFields
        properties={['backgroundColor']}
        value={{}}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Eredita dal tema'), {
      target: { value: '#ff0000' },
    });

    expect(onChange).toHaveBeenCalledWith({ backgroundColor: '#ff0000' });
  });
});
