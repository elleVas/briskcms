import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { PickedMedia } from '@brisk/shared-types';
import {
  MediaPickerContext,
  type MediaPickerPort,
} from '../media-picker-context.js';
import {
  GalleryPickerField,
  type GalleryImageItem,
} from './gallery-picker-field.js';

const media: PickedMedia = { mediaId: 'm1', url: '/m1.jpg' };

function wrapperWith(port: MediaPickerPort) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MediaPickerContext.Provider value={port}>
        {children}
      </MediaPickerContext.Provider>
    );
  };
}

describe('GalleryPickerField', () => {
  it('renders one slot per item, plus an "Aggiungi immagine" button, with no preview image for an empty slot', () => {
    const value: GalleryImageItem[] = [
      { media: null, alt: '', isDecorative: false },
    ];
    render(<GalleryPickerField value={value} onChange={vi.fn()} />, {
      wrapper: wrapperWith({ pick: vi.fn() }),
    });

    expect(screen.getByText('Scegli immagine')).toBeTruthy();
    expect(screen.getByText('Aggiungi immagine')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });

  it('appends an empty slot when "Aggiungi immagine" is clicked', () => {
    const onChange = vi.fn();
    render(<GalleryPickerField value={[]} onChange={onChange} />, {
      wrapper: wrapperWith({ pick: vi.fn() }),
    });

    fireEvent.click(screen.getByText('Aggiungi immagine'));

    expect(onChange).toHaveBeenCalledWith([
      { media: null, alt: '', isDecorative: false },
    ]);
  });

  it('removes only the targeted slot when its "Rimuovi" is clicked', () => {
    const onChange = vi.fn();
    const value: GalleryImageItem[] = [
      { media, alt: 'Prima', isDecorative: false },
      { media: null, alt: 'Seconda', isDecorative: false },
    ];
    render(<GalleryPickerField value={value} onChange={onChange} />, {
      wrapper: wrapperWith({ pick: vi.fn() }),
    });

    fireEvent.click(screen.getAllByText('Rimuovi')[0]);

    expect(onChange).toHaveBeenCalledWith([
      { media: null, alt: 'Seconda', isDecorative: false },
    ]);
  });

  it('updates only the alt text of the edited slot', () => {
    const onChange = vi.fn();
    const value: GalleryImageItem[] = [
      { media: null, alt: 'Vecchio', isDecorative: false },
      { media: null, alt: 'Altro', isDecorative: false },
    ];
    render(<GalleryPickerField value={value} onChange={onChange} />, {
      wrapper: wrapperWith({ pick: vi.fn() }),
    });

    fireEvent.change(screen.getAllByPlaceholderText('Testo alternativo')[0], {
      target: { value: 'Nuovo' },
    });

    expect(onChange).toHaveBeenCalledWith([
      { media: null, alt: 'Nuovo', isDecorative: false },
      { media: null, alt: 'Altro', isDecorative: false },
    ]);
  });

  it('sets the media of the targeted slot when the picker resolves one', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue(media);
    const value: GalleryImageItem[] = [
      { media: null, alt: '', isDecorative: false },
    ];
    render(<GalleryPickerField value={value} onChange={onChange} />, {
      wrapper: wrapperWith({ pick }),
    });

    fireEvent.click(screen.getByText('Scegli immagine'));
    await Promise.resolve();
    await Promise.resolve();

    expect(onChange).toHaveBeenCalledWith([
      { media, alt: '', isDecorative: false },
    ]);
  });

  it('shows the preview image and "Cambia immagine" once a slot has media', () => {
    const value: GalleryImageItem[] = [{ media, alt: '', isDecorative: false }];
    render(<GalleryPickerField value={value} onChange={vi.fn()} />, {
      wrapper: wrapperWith({ pick: vi.fn() }),
    });

    expect(screen.getByText('Cambia immagine')).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/m1.jpg');
  });

  it('warns when alt is empty and the item is not marked decorative', () => {
    const value: GalleryImageItem[] = [{ media, alt: '', isDecorative: false }];
    render(<GalleryPickerField value={value} onChange={vi.fn()} />, {
      wrapper: wrapperWith({ pick: vi.fn() }),
    });

    expect(
      screen.getByText('Testo alternativo richiesto (o segna come decorativa)'),
    ).toBeTruthy();
  });

  it('does not warn once the item is marked decorative, and disables its alt input', () => {
    const onChange = vi.fn();
    const value: GalleryImageItem[] = [{ media, alt: '', isDecorative: false }];
    render(<GalleryPickerField value={value} onChange={onChange} />, {
      wrapper: wrapperWith({ pick: vi.fn() }),
    });

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith([
      { media, alt: '', isDecorative: true },
    ]);
  });

  it('does not warn when alt already has a value', () => {
    const value: GalleryImageItem[] = [
      { media, alt: 'Un gatto', isDecorative: false },
    ];
    render(<GalleryPickerField value={value} onChange={vi.fn()} />, {
      wrapper: wrapperWith({ pick: vi.fn() }),
    });

    expect(
      screen.queryByText(
        'Testo alternativo richiesto (o segna come decorativa)',
      ),
    ).toBeNull();
  });
});
