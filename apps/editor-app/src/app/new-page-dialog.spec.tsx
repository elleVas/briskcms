import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/http-client.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { NewPageDialog } from './new-page-dialog.js';

const samplePage: PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  locale: 'it',
  slug: 'chi-siamo',
  status: 'draft',
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Chi siamo', description: '' },
  createdAt: '',
  updatedAt: '',
};

describe('NewPageDialog', () => {
  it('shows a live slug preview as the name is typed', () => {
    render(<NewPageDialog open onOpenChange={vi.fn()} onCreate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Nome pagina'), {
      target: { value: 'Chi Siamo' },
    });

    expect(screen.getByText('URL: chi-siamo')).toBeTruthy();
  });

  it('creates the page and closes the dialog on success', async () => {
    const onCreate = vi.fn().mockResolvedValue(samplePage);
    const onOpenChange = vi.fn();
    render(
      <NewPageDialog open onOpenChange={onOpenChange} onCreate={onCreate} />,
    );

    fireEvent.change(screen.getByLabelText('Nome pagina'), {
      target: { value: 'Chi Siamo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^crea$/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Chi Siamo'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('shows a friendly message when the name is already taken', async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValue(new ApiError(409, { message: 'conflict' }));
    render(<NewPageDialog open onOpenChange={vi.fn()} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Nome pagina'), {
      target: { value: 'Chi Siamo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^crea$/i }));

    expect(
      await screen.findByText(/esiste già una pagina con questo nome/i),
    ).toBeTruthy();
  });

  it('calls onOpenChange without creating when cancelled', () => {
    const onCreate = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <NewPageDialog open onOpenChange={onOpenChange} onCreate={onCreate} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
