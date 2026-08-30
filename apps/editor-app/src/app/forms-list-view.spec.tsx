import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/forms-api-client';
import type { FormDto } from '../lib/forms-api-client';
import { createTestQueryClient } from '../test-query-client';
import { FormsListView } from './forms-list-view';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/forms-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/forms-api-client')>();
  return { ...actual, createForm: vi.fn(), deleteForm: vi.fn() };
});

const formOne: FormDto = {
  id: 'form-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  name: 'Contact form',
  fields: [{ id: 'field-1', type: 'text', label: 'Nome', required: true }],
  steps: [],
  notificationEmail: null,
  createdAt: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderView(
  forms: FormDto[],
  options: { page?: number; total?: number } = {},
) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <FormsListView
          siteId="site-1"
          forms={forms}
          page={options.page ?? 1}
          total={options.total ?? forms.length}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('FormsListView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no forms', () => {
    renderView([]);

    expect(screen.getByText(/nessun modulo ancora/i)).toBeTruthy();
  });

  it('lists forms with their name and field count', () => {
    renderView([formOne]);

    expect(screen.getByText('Contact form')).toBeTruthy();
    expect(screen.getByText('1 campo')).toBeTruthy();
  });

  it('opens the editor for the selected form', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);

    renderView([formOne]);
    fireEvent.click(screen.getByRole('button', { name: /contact form/i }));
    fireEvent.click(screen.getByRole('button', { name: /modifica modulo/i }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/forms/$formId',
        params: { formId: formOne.id },
      }),
    );
  });

  it('deletes the selected form after confirming', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.deleteForm).mockResolvedValue(undefined);

    renderView([formOne]);
    fireEvent.click(screen.getByRole('button', { name: /contact form/i }));
    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    expect(screen.getByText(/eliminare questo modulo/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    await waitFor(() =>
      expect(api.deleteForm).toHaveBeenCalledWith(formOne.id),
    );
  });

  it('opens the new form dialog', () => {
    renderView([]);

    fireEvent.click(screen.getByRole('button', { name: /nuovo modulo/i }));

    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows pagination controls when there is more than one page', () => {
    renderView([formOne], { total: 40 });

    expect(screen.getByText('Pagina 1 di 2')).toBeTruthy();
  });
});
