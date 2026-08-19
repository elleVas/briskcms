import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PickedPage } from '@brisk/shared-types';
import { PageListContext } from '../page-list-context.js';
import { PagePickerField } from './page-picker-field.js';

const samplePicked: PickedPage = {
  pageId: 'page-1',
  locale: 'it',
  slug: 'chi-siamo',
  title: 'Chi siamo',
};

function renderField(
  value: PickedPage | null,
  onChange: (value: PickedPage | null) => void,
  pick: () => Promise<PickedPage | null>,
) {
  return render(
    <PageListContext.Provider value={{ pick }}>
      <PagePickerField value={value} onChange={onChange} />
    </PageListContext.Provider>,
  );
}

describe('PagePickerField', () => {
  it('shows "Scegli pagina" and no title when nothing is selected', () => {
    renderField(null, vi.fn(), vi.fn());

    expect(screen.getByText('Scegli pagina')).toBeTruthy();
    expect(screen.queryByText('Chi siamo')).toBeFalsy();
  });

  it('shows the page title and "Cambia pagina" when a page is selected', () => {
    renderField(samplePicked, vi.fn(), vi.fn());

    expect(screen.getByText('Chi siamo')).toBeTruthy();
    expect(screen.getByText('Cambia pagina')).toBeTruthy();
  });

  it('calls onChange with the picked page once the picker resolves', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue(samplePicked);
    renderField(null, onChange, pick);

    fireEvent.click(screen.getByText('Scegli pagina'));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(samplePicked));
  });

  it('does not call onChange when the picker is dismissed without a selection', async () => {
    const onChange = vi.fn();
    const pick = vi.fn().mockResolvedValue(null);
    renderField(null, onChange, pick);

    fireEvent.click(screen.getByText('Scegli pagina'));
    await vi.waitFor(() => expect(pick).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });
});
