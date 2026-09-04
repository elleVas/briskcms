import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/forms-api-client';
import type { FormDto } from '../lib/forms-api-client';
import { createTestQueryClient } from '../test-query-client';
import { formQueryOptions } from './forms-queries';
import { FormEditorView } from './form-editor-view';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

vi.mock('../lib/forms-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/forms-api-client')>();
  return { ...actual, updateForm: vi.fn() };
});

const sampleForm: FormDto = {
  id: 'form-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  name: 'Candidatura',
  fields: [
    { id: 'nome', label: 'Nome', type: 'text', required: true },
    {
      id: 'esperienza',
      label: 'Esperienza',
      type: 'textarea',
      required: false,
    },
  ],
  steps: [],
  notificationEmail: null,
  createdAt: '',
  updatedAt: '',
  submissionCount: 0,
};

function renderView(form: FormDto = sampleForm) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(formQueryOptions(form.id).queryKey, form);
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FormEditorView formId={form.id} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('FormEditorView — multi-step', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows no step-assignment dropdown and a "no steps" hint for a plain single-step form', () => {
    renderView();

    expect(
      screen.getByText('Nessuno step: il modulo è a pagina singola.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Step')).toBeFalsy();
  });

  it('adding a step reveals a per-field step-assignment dropdown', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: /aggiungi step/i }));

    expect(screen.getByPlaceholderText('Titolo dello step')).toBeTruthy();
    // Two fields in sampleForm, each now shows its own step dropdown.
    expect(screen.getAllByLabelText('Step')).toHaveLength(2);
  });

  it('assigning a field to a step, then removing that step, clears the assignment back to none', () => {
    renderView({
      ...sampleForm,
      steps: [{ id: 'step-1', title: 'Dati' }],
    });

    const [fieldStepSelect] = screen.getAllByLabelText('Step');
    fireEvent.change(fieldStepSelect, { target: { value: 'step-1' } });
    expect((fieldStepSelect as HTMLSelectElement).value).toBe('step-1');

    fireEvent.click(screen.getByRole('button', { name: /rimuovi step/i }));

    // No steps left at all now, so the dropdown disappears entirely —
    // the field's stepId was cleared, not left dangling on a deleted step.
    expect(screen.queryByLabelText('Step')).toBeFalsy();
  });

  it('saves the current steps alongside name and fields', async () => {
    vi.mocked(api.updateForm).mockResolvedValue({
      ...sampleForm,
      steps: [{ id: 'step-1', title: 'Dati personali' }],
    });
    renderView();

    fireEvent.click(screen.getByRole('button', { name: /aggiungi step/i }));
    fireEvent.change(screen.getByPlaceholderText('Titolo dello step'), {
      target: { value: 'Dati personali' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^salva$/i }));

    await vi.waitFor(() =>
      expect(api.updateForm).toHaveBeenCalledWith(
        'form-1',
        expect.objectContaining({
          steps: [expect.objectContaining({ title: 'Dati personali' })],
        }),
      ),
    );
  });
});
