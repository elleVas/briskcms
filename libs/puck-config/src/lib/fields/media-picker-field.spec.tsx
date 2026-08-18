import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PickedMedia } from '@brisk/shared-types';
import { MediaPickerContext } from '../media-picker-context.js';
import { MediaPickerField } from './media-picker-field.js';

const samplePicked: PickedMedia = {
  mediaId: 'media-1',
  url: 'http://localhost/uploads/media-1.webp',
};

function renderField(
  value: PickedMedia | null,
  onChange: (value: PickedMedia | null) => void,
  pick: () => Promise<PickedMedia | null>,
) {
  return render(
    <MediaPickerContext.Provider value={{ pick }}>
      <MediaPickerField value={value} onChange={onChange} />
    </MediaPickerContext.Provider>,
  );
}

describe('MediaPickerField', () => {
  it('shows "Scegli immagine" and no thumbnail when nothing is selected', () => {
    renderField(null, vi.fn(), vi.fn());

    expect(screen.getByText('Scegli immagine')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeFalsy();
  });

  it('shows a thumbnail and "Cambia immagine" when a media is selected', () => {
    // The alt-text field lives separately on the block (see image.block.tsx
    // / gallery.block.tsx) — this preview thumbnail is decorative, so
    // alt="" is correct and it has no accessible "img" role; query the DOM
    // directly instead of by role.
    const { container } = renderField(samplePicked, vi.fn(), vi.fn());

    expect(screen.getByText('Cambia immagine')).toBeTruthy();
    expect(container.querySelector('img')).toHaveProperty(
      'src',
      samplePicked.url,
    );
  });

  it('calls onChange with the picked media once the picker resolves', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue(samplePicked);
    renderField(null, onChange, pick);

    fireEvent.click(screen.getByText('Scegli immagine'));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(samplePicked));
  });

  it('does not call onChange when the picker is dismissed without a selection', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue(null);
    renderField(null, onChange, pick);

    fireEvent.click(screen.getByText('Scegli immagine'));
    await vi.waitFor(() => expect(pick).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });
});
