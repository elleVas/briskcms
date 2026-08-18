import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PickedMedia } from '@brisk/shared-types';
import { MediaPickerContext } from '../media-picker-context.js';
import {
  GalleryPickerField,
  type GalleryImageItem,
} from './gallery-picker-field.js';

const samplePicked: PickedMedia = {
  mediaId: 'media-1',
  url: 'http://localhost/uploads/media-1.webp',
};

function renderField(
  value: GalleryImageItem[],
  onChange: (value: GalleryImageItem[]) => void,
  pick: () => Promise<PickedMedia | null> = vi.fn(),
) {
  return render(
    <MediaPickerContext.Provider value={{ pick }}>
      <GalleryPickerField value={value} onChange={onChange} />
    </MediaPickerContext.Provider>,
  );
}

describe('GalleryPickerField', () => {
  it('shows every row fully expanded, with no collapse step', () => {
    renderField(
      [
        { media: null, alt: '' },
        { media: samplePicked, alt: 'Seconda foto' },
      ],
      vi.fn(),
    );

    expect(screen.getAllByText('Scegli immagine')).toHaveLength(1);
    expect(screen.getAllByText('Cambia immagine')).toHaveLength(1);
    expect(screen.getAllByPlaceholderText('Testo alternativo')).toHaveLength(2);
  });

  it('adds a new empty slot', () => {
    const onChange = vi.fn();
    renderField([], onChange);

    fireEvent.click(screen.getByText('Aggiungi immagine'));

    expect(onChange).toHaveBeenCalledWith([{ media: null, alt: '' }]);
  });

  it('picks an image for the given slot without touching the others', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue(samplePicked);
    renderField(
      [
        { media: null, alt: '' },
        { media: null, alt: 'seconda' },
      ],
      onChange,
      pick,
    );

    fireEvent.click(screen.getAllByText('Scegli immagine')[1]);
    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        { media: null, alt: '' },
        { media: samplePicked, alt: 'seconda' },
      ]),
    );
  });

  it('updates the alt text for the given slot', () => {
    const onChange = vi.fn();
    renderField([{ media: samplePicked, alt: '' }], onChange);

    fireEvent.change(screen.getByPlaceholderText('Testo alternativo'), {
      target: { value: 'Descrizione' },
    });

    expect(onChange).toHaveBeenCalledWith([
      { media: samplePicked, alt: 'Descrizione' },
    ]);
  });

  it('removes a slot', () => {
    const onChange = vi.fn();
    renderField(
      [
        { media: samplePicked, alt: 'prima' },
        { media: null, alt: 'seconda' },
      ],
      onChange,
    );

    fireEvent.click(screen.getAllByText('Rimuovi')[0]);

    expect(onChange).toHaveBeenCalledWith([{ media: null, alt: 'seconda' }]);
  });
});
