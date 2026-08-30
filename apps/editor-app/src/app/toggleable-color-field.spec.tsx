import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToggleableColorField } from './toggleable-color-field';

describe('ToggleableColorField', () => {
  it('hides the color picker when disabled', () => {
    render(
      <ToggleableColorField
        id="test-color"
        label="Colore primario"
        overrideLabel="Personalizza"
        enabled={false}
        onEnabledChange={vi.fn()}
        value="#18181b"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.queryByDisplayValue('#18181b')).toBeNull();
  });

  it('shows the color picker and its hex value when enabled', () => {
    render(
      <ToggleableColorField
        id="test-color"
        label="Colore primario"
        overrideLabel="Personalizza"
        enabled={true}
        onEnabledChange={vi.fn()}
        value="#18181b"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText('#18181b')).toBeTruthy();
  });

  it('calls onEnabledChange when the checkbox is toggled', () => {
    const onEnabledChange = vi.fn();
    render(
      <ToggleableColorField
        id="test-color"
        label="Colore primario"
        overrideLabel="Personalizza"
        enabled={false}
        onEnabledChange={onEnabledChange}
        value="#18181b"
        onValueChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it('calls onValueChange when the color input changes', () => {
    const onValueChange = vi.fn();
    render(
      <ToggleableColorField
        id="test-color"
        label="Colore primario"
        overrideLabel="Personalizza"
        enabled={true}
        onEnabledChange={vi.fn()}
        value="#18181b"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Colore primario'), {
      target: { value: '#ff0000' },
    });

    expect(onValueChange).toHaveBeenCalledWith('#ff0000');
  });
});
