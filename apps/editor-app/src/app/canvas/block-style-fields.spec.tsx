import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockStyleFields } from './block-style-fields';

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

  it('shows the resolved theme default as the placeholder for a length field', () => {
    render(
      <BlockStyleFields
        properties={['borderRadius']}
        value={{}}
        onChange={vi.fn()}
        defaults={{ borderRadius: '0.5rem' }}
      />,
    );

    expect(screen.getByPlaceholderText('0.5rem')).toBeTruthy();
  });

  it('passes the resolved theme default through to ColorPickerField as a preview', () => {
    render(
      <BlockStyleFields
        properties={['backgroundColor']}
        value={{}}
        onChange={vi.fn()}
        defaults={{ backgroundColor: 'oklch(0.205 0 0)' }}
      />,
    );

    expect(screen.getByPlaceholderText('Tema: oklch(0.205 0 0)')).toBeTruthy();
  });

  it('renders marginTop/marginBottom as plain length fields, same as paddingX/paddingY', () => {
    const onChange = vi.fn();
    render(
      <BlockStyleFields
        properties={['marginTop', 'marginBottom']}
        value={{ marginBottom: '2rem' }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Spazio sopra')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Spazio sotto')).toHaveProperty(
      'value',
      '2rem',
    );

    fireEvent.change(screen.getByLabelText('Spazio sopra'), {
      target: { value: '1rem' },
    });

    expect(onChange).toHaveBeenCalledWith({
      marginBottom: '2rem',
      marginTop: '1rem',
    });
  });
});
