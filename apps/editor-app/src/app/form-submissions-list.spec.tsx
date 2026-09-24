import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { FormField } from '@brisk/shared-types';
import * as api from '../lib/forms-api-client';
import { createTestQueryClient } from '../test/query-client.test-fixture';
import { FormSubmissionsList } from './form-submissions-list';

// `Link` needs a router context this component-only render does not have.
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: (await import('../test/router-link.test-fixture')).StubLink,
}));

vi.mock('../lib/forms-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/forms-api-client')>();
  return { ...actual, listFormSubmissions: vi.fn() };
});

const FIELDS: FormField[] = [
  { id: 'name', label: 'Nome', type: 'text', required: true },
  { id: 'note', label: 'Messaggio', type: 'textarea', required: false },
];

function renderList(
  items: {
    id: string;
    payload: Record<string, unknown>;
    createdAt: string;
    pageId?: string | null;
  }[],
  fields = FIELDS,
  pages: api.SubmissionOriginPageDto[] = [],
) {
  vi.mocked(api.listFormSubmissions).mockResolvedValue({
    items: items.map((item) => ({ pageId: null, ...item })),
    total: items.length,
    fields,
    pages,
  });
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <FormSubmissionsList formId="f1" />
    </QueryClientProvider>,
  );
}

const AT = '2026-09-04T09:10:00.000Z';

describe('FormSubmissionsList', () => {
  it('says so plainly when nothing has come in', async () => {
    renderList([]);

    expect(
      await screen.findByText(/compariranno qui|will show up here/i),
    ).toBeTruthy();
  });

  it('shows an answer under its field label once expanded', async () => {
    renderList([
      { id: 's1', payload: { name: 'Mario', note: 'Ciao' }, createdAt: AT },
    ]);

    fireEvent.click(await screen.findByRole('button', { expanded: false }));

    expect(screen.getByText('Messaggio')).toBeTruthy();
    expect(screen.getByText('Ciao')).toBeTruthy();
  });

  it('keeps an answer whose field was removed, and marks it as such', async () => {
    // The case the whole shape of this view exists for: a payload is keyed
    // by field id, and the form's fields change afterwards. Dropping the
    // value would silently lose something a person actually typed.
    renderList([
      { id: 's1', payload: { name: 'Mario', azienda: 'Acme' }, createdAt: AT },
    ]);

    fireEvent.click(await screen.findByRole('button', { expanded: false }));

    expect(screen.getByText('Acme')).toBeTruthy();
    expect(
      screen.getByText(/non è più nel modulo|no longer in this form/i),
    ).toBeTruthy();
  });

  it('renders a file answer as a download link, not [object Object]', async () => {
    renderList([
      {
        id: 's1',
        payload: { name: { filename: 'cv.pdf', url: 'https://x/cv.pdf' } },
        createdAt: AT,
      },
    ]);

    fireEvent.click(await screen.findByRole('button', { expanded: false }));

    const link = screen.getByRole('link', { name: /cv\.pdf/ });
    expect(link.getAttribute('href')).toBe('https://x/cv.pdf');
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  });

  it('says which page a submission was filled on, and links to it', async () => {
    renderList(
      [{ id: 's1', payload: { name: 'Mario' }, createdAt: AT, pageId: 'pt-1' }],
      FIELDS,
      [
        {
          id: 'pt-1',
          pageGroupId: 'group-1',
          locale: 'it',
          title: 'Contatti',
        },
      ],
    );

    fireEvent.click(await screen.findByRole('button', { name: /Mario/ }));

    const link = screen.getByRole('link', { name: 'Contatti' });
    expect(link.getAttribute('href')).toBe('/page-groups/group-1');
  });

  it('shows no page for a submission that carries none', async () => {
    // Every submission recorded before the public site knew which page it
    // was rendering, and every one whose page has since been deleted.
    renderList([{ id: 's1', payload: { name: 'Mario' }, createdAt: AT }]);

    fireEvent.click(await screen.findByRole('button', { name: /Mario/ }));

    expect(screen.queryByRole('link', { name: 'Contatti' })).toBeNull();
    expect(
      screen.queryByText(/Inviato dalla pagina|Submitted from/i),
    ).toBeNull();
  });

  it('offers the export only when there is something to export', async () => {
    renderList([]);

    expect(
      await screen.findByText(/compariranno qui|will show up here/i),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: /csv/i })).toBeNull();
  });

  it('links the export to the CSV endpoint when there is', async () => {
    renderList([{ id: 's1', payload: { name: 'Mario' }, createdAt: AT }]);

    const link = await screen.findByRole('link', { name: /csv/i });
    expect(link.getAttribute('href')).toContain('/forms/f1/submissions.csv');
  });
});
