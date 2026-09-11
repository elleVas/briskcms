import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as previewTokenApi from '../../lib/preview-token-api-client';
import { useCanvasPreviewToken } from './use-canvas-preview-token';

vi.mock('../../lib/preview-token-api-client', () => ({
  createTranslationPreviewToken: vi.fn(),
  createReusableSectionPreviewToken: vi.fn(),
}));

describe('useCanvasPreviewToken', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('mints a page token for a page, and hands it back', async () => {
    vi.mocked(previewTokenApi.createTranslationPreviewToken).mockResolvedValue({
      token: 'page-token',
      expiresAt: '',
    });

    const { result } = renderHook(() =>
      useCanvasPreviewToken('page-1', undefined),
    );

    await waitFor(() => expect(result.current).toBe('page-token'));
    expect(previewTokenApi.createTranslationPreviewToken).toHaveBeenCalledWith(
      'page-1',
    );
  });

  /*
   * The section editor passes `sectionPreview` as an object literal — a new
   * one on every render. Keyed on the object, the hook asked the API for a
   * fresh token every time the editor re-rendered.
   */
  it('does not mint again when re-rendered with an equal but new section object', async () => {
    vi.mocked(
      previewTokenApi.createReusableSectionPreviewToken,
    ).mockResolvedValue({ token: 'section-token', expiresAt: '' });

    const { result, rerender } = renderHook(
      ({ locale }) =>
        useCanvasPreviewToken('section-1', { sectionId: 'section-1', locale }),
      { initialProps: { locale: 'it' } },
    );
    await waitFor(() => expect(result.current).toBe('section-token'));

    rerender({ locale: 'it' });
    rerender({ locale: 'it' });

    expect(
      previewTokenApi.createReusableSectionPreviewToken,
    ).toHaveBeenCalledTimes(1);
  });

  it('mints a new one when the section itself changes', async () => {
    vi.mocked(
      previewTokenApi.createReusableSectionPreviewToken,
    ).mockResolvedValue({ token: 'section-token', expiresAt: '' });

    const { rerender } = renderHook(
      ({ sectionId }) =>
        useCanvasPreviewToken(sectionId, { sectionId, locale: 'it' }),
      { initialProps: { sectionId: 'section-1' } },
    );
    rerender({ sectionId: 'section-2' });

    await waitFor(() =>
      expect(
        previewTokenApi.createReusableSectionPreviewToken,
      ).toHaveBeenCalledWith('section-2'),
    );
  });
});
