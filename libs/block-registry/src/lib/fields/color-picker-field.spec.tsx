import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPickerField } from './color-picker-field.js';

describe('ColorPickerField', () => {
  it('renders the theme-default swatch and empty text input when value is null', () => {
    render(<ColorPickerField value={null} onChange={vi.fn()} />);

    const colorInput = document.querySelector(
      'input[type="color"]',
    ) as HTMLInputElement;
    expect(colorInput.value).toBe('#000000');
    expect(screen.getByPlaceholderText('Eredita dal tema')).toHaveProperty(
      'value',
      '',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reports the new value when the color swatch changes', () => {
    const onChange = vi.fn();
    render(<ColorPickerField value="#123456" onChange={onChange} />);

    const colorInput = document.querySelector(
      'input[type="color"]',
    ) as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: '#abcdef' } });

    expect(onChange).toHaveBeenCalledWith('#abcdef');
  });

  it('reports a valid typed hex value', () => {
    const onChange = vi.fn();
    render(<ColorPickerField value={null} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('Eredita dal tema'), {
      target: { value: '#ff00ff' },
    });

    expect(onChange).toHaveBeenCalledWith('#ff00ff');
  });

  it('ignores a malformed typed value instead of reporting it', () => {
    const onChange = vi.fn();
    render(<ColorPickerField value={null} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('Eredita dal tema'), {
      target: { value: 'not-a-color' },
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports null when the typed value is cleared to empty', () => {
    const onChange = vi.fn();
    render(<ColorPickerField value="#123456" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('Eredita dal tema'), {
      target: { value: '' },
    });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows a clear button when a value is set, and it reports null when clicked', () => {
    const onChange = vi.fn();
    render(<ColorPickerField value="#123456" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
