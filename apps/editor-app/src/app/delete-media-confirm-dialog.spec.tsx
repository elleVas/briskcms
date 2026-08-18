import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteMediaConfirmDialog } from './delete-media-confirm-dialog.js';

describe('DeleteMediaConfirmDialog', () => {
  it('shows the filename in the confirmation text', () => {
    render(
      <DeleteMediaConfirmDialog
        open
        onOpenChange={vi.fn()}
        filename="foto.png"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/"foto\.png"/)).toBeTruthy();
  });

  it('calls onConfirm when the destructive action is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteMediaConfirmDialog
        open
        onOpenChange={vi.fn()}
        filename="foto.png"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not call onConfirm when cancelled', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteMediaConfirmDialog
        open
        onOpenChange={vi.fn()}
        filename="foto.png"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
