import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    // This view is rendered without a router here; the real one needs a
    // history to hold a navigation against. The blocker's own behaviour is
    // covered by the test below that drives it directly.
    useBlocker: () => ({ status: 'idle' as const }),
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

/*
 * This screen saves only when somebody presses Save, and until now it let
 * you leave a half-built form without a word: no dirty mark, no question.
 */
describe('FormEditorView — unsaved work', () => {
  it('marks the form dirty once something changes, and clean again after a save', async () => {
    vi.mocked(api.updateForm).mockResolvedValue(sampleForm);
    renderView();

    expect(screen.queryByText('Modifiche non salvate')).toBeNull();

    fireEvent.change(screen.getByLabelText('Nome modulo'), {
      target: { value: 'Contatti 2' },
    });
    expect(screen.getByText('Modifiche non salvate')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() =>
      expect(screen.queryByText('Modifiche non salvate')).toBeNull(),
    );
  });

  /*
   * The dirty mark compared the raw state against a baseline built from
   * the SAVED — trimmed, tidied — one, so anything the save normalised
   * left the editor permanently unsaved: the mark stayed on a form that
   * had just been written, and the guard then put "you will lose your
   * work" in front of every link. A warning that is always wrong is worse
   * than none, because people learn to click through it.
   */
  it('is clean after saving a select whose options end in a blank line', async () => {
    // The notification email cannot get stuck the same way, even though
    // the save trims it too: `type="email"` makes the browser strip the
    // spaces before React ever sees them. The options textarea has no such
    // help, which is why this is the case worth pinning.
    const withSelect: FormDto = {
      ...sampleForm,
      fields: [
        {
          id: 'scelta',
          label: 'Scelta',
          type: 'select',
          required: false,
          options: ['A'],
        },
      ],
    };
    vi.mocked(api.updateForm).mockResolvedValue({
      ...withSelect,
      fields: [{ ...withSelect.fields[0], options: ['A', 'B'] }],
    });
    renderView(withSelect);

    // What a textarea leaves behind when somebody presses Enter after the
    // last option: an empty string the save drops.
    fireEvent.change(screen.getByLabelText('Opzioni (una per riga)'), {
      target: { value: 'A\nB\n' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await screen.findByText('Modulo salvato');
    expect(screen.queryByText('Modifiche non salvate')).toBeNull();
  });

  it('stops being dirty when a change is typed back to what was saved', () => {
    renderView();
    const name = screen.getByLabelText('Nome modulo');

    fireEvent.change(name, { target: { value: 'altro' } });
    expect(screen.getByText('Modifiche non salvate')).toBeTruthy();

    fireEvent.change(name, { target: { value: sampleForm.name } });
    expect(screen.queryByText('Modifiche non salvate')).toBeNull();
  });
});

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
