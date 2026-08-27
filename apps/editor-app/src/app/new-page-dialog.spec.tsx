import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../lib/http-client.js';
import type { PageRecord } from '../lib/pages-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { NewPageDialog, type NewPageDialogProps } from './new-page-dialog.js';

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  // ParentPageSelect queries listPages on its own — mocked so it resolves
  // immediately instead of hitting the real fetch().
  return {
    ...actual,
    listPages: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
});

const samplePage: PageRecord = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'chi-siamo',
  status: 'draft',
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Chi siamo', description: '' },
  createdAt: '',
  updatedAt: '',
};

function renderDialog(props: Omit<NewPageDialogProps, 'siteId' | 'locale'>) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <NewPageDialog siteId="site-1" locale="it" {...props} />
    </QueryClientProvider>,
  );
}

describe('NewPageDialog', () => {
  it('shows a live slug preview as the name is typed', () => {
    renderDialog({ open: true, onOpenChange: vi.fn(), onCreate: vi.fn() });

    fireEvent.change(screen.getByLabelText('Nome pagina'), {
      target: { value: 'Chi Siamo' },
    });

    expect(screen.getByText('URL: chi-siamo')).toBeTruthy();
  });

  it('creates the page and closes the dialog on success', async () => {
    const onCreate = vi.fn().mockResolvedValue(samplePage);
    const onOpenChange = vi.fn();
    renderDialog({ open: true, onOpenChange, onCreate });

    fireEvent.change(screen.getByLabelText('Nome pagina'), {
      target: { value: 'Chi Siamo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^crea$/i }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith('Chi Siamo', null),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('shows a friendly message when the name is already taken', async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValue(new ApiError(409, { message: 'conflict' }));
    renderDialog({ open: true, onOpenChange: vi.fn(), onCreate });

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
    renderDialog({ open: true, onOpenChange, onCreate });

    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
