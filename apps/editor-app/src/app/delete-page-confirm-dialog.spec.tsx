import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeletePageConfirmDialog } from './delete-page-confirm-dialog.js';

describe('DeletePageConfirmDialog', () => {
  it('shows the page name in the confirmation text', () => {
    render(
      <DeletePageConfirmDialog
        open
        onOpenChange={vi.fn()}
        pageName="Chi siamo"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/"Chi siamo"/)).toBeTruthy();
  });

  it('calls onConfirm when the destructive action is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DeletePageConfirmDialog
        open
        onOpenChange={vi.fn()}
        pageName="Chi siamo"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not call onConfirm when cancelled', () => {
    const onConfirm = vi.fn();
    render(
      <DeletePageConfirmDialog
        open
        onOpenChange={vi.fn()}
        pageName="Chi siamo"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
