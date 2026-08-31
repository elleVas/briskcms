import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/http-client';
import type { PageListItem } from '../lib/pages-api-client';
import { DuplicatePageDialog } from './duplicate-page-dialog';

const sourcePage: PageListItem = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'chi-siamo',
  status: 'published',
  seoMeta: { title: 'Chi siamo', description: 'La nostra storia' },
  order: 0,
  createdByName: null,
  createdAt: '',
  updatedAt: '',
  hasUnpublishedChanges: false,
};

describe('DuplicatePageDialog', () => {
  it('pre-fills title, slug and description from the source page', () => {
    render(
      <DuplicatePageDialog
        sourcePage={sourcePage}
        open={true}
        onOpenChange={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Titolo')).toHaveProperty(
      'value',
      'Chi siamo',
    );
    expect(screen.getByLabelText('URL')).toHaveProperty(
      'value',
      'chi-siamo-copia',
    );
    expect(screen.getByLabelText('Descrizione SEO')).toHaveProperty(
      'value',
      'La nostra storia',
    );
  });

  it('duplicates the page with the edited fields and closes on success', async () => {
    const onDuplicate = vi.fn().mockResolvedValue(sourcePage);
    const onOpenChange = vi.fn();
    render(
      <DuplicatePageDialog
        sourcePage={sourcePage}
        open={true}
        onOpenChange={onOpenChange}
        onDuplicate={onDuplicate}
      />,
    );

    fireEvent.change(screen.getByLabelText('Titolo'), {
      target: { value: 'Chi siamo (copia)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crea copia/i }));

    await waitFor(() =>
      expect(onDuplicate).toHaveBeenCalledWith({
        slug: 'chi-siamo-copia',
        title: 'Chi siamo (copia)',
        description: 'La nostra storia',
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('shows a friendly message when the slug is already taken', async () => {
    const onDuplicate = vi
      .fn()
      .mockRejectedValue(new ApiError(409, { message: 'conflict' }));
    render(
      <DuplicatePageDialog
        sourcePage={sourcePage}
        open={true}
        onOpenChange={vi.fn()}
        onDuplicate={onDuplicate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /crea copia/i }));

    expect(
      await screen.findByText(/esiste già una pagina con questo url/i),
    ).toBeTruthy();
  });

  it('calls onOpenChange without duplicating when cancelled', () => {
    const onDuplicate = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DuplicatePageDialog
        sourcePage={sourcePage}
        open={true}
        onOpenChange={onOpenChange}
        onDuplicate={onDuplicate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDuplicate).not.toHaveBeenCalled();
  });

  it('re-syncs fields from a new source page when reopened', () => {
    const { rerender } = render(
      <DuplicatePageDialog
        sourcePage={sourcePage}
        open={true}
        onOpenChange={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Titolo'), {
      target: { value: 'Modificato a mano' },
    });

    rerender(
      <DuplicatePageDialog
        sourcePage={sourcePage}
        open={false}
        onOpenChange={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    const otherPage: PageListItem = {
      ...sourcePage,
      id: 'page-2',
      slug: 'contatti',
      seoMeta: { title: 'Contatti', description: 'Scrivici' },
    };
    rerender(
      <DuplicatePageDialog
        sourcePage={otherPage}
        open={true}
        onOpenChange={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Titolo')).toHaveProperty('value', 'Contatti');
    expect(screen.getByLabelText('URL')).toHaveProperty(
      'value',
      'contatti-copia',
    );
  });
});
