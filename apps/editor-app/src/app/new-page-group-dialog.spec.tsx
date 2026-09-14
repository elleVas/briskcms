import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as collectionsApi from '../lib/collections-api-client';
import { ApiError } from '../lib/http-client';
import * as sectionsApi from '../lib/reusable-sections-api-client';
import { createTestQueryClient } from '../test-query-client';
import { NewPageGroupDialog } from './new-page-group-dialog';
import type { NewPageGroupInput } from './use-page-groups-list';

vi.mock('../lib/reusable-sections-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../lib/reusable-sections-api-client')
    >();
  return { ...actual, listReusableSections: vi.fn() };
});

vi.mock('../lib/collections-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/collections-api-client')>();
  return { ...actual, listCollections: vi.fn() };
});

function section(
  overrides: Partial<sectionsApi.ReusableSectionListItemDto>,
): sectionsApi.ReusableSectionListItemDto {
  const blocks = [{ id: 'hero-1', type: 'Hero', props: { title: 'Hi' } }];
  return {
    id: 'section-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    name: 'Section',
    kind: 'template',
    status: 'published',
    content: blocks,
    publishedContent: blocks,
    exposedFields: {},
    createdBy: null,
    createdAt: '',
    updatedAt: '',
    usedOnPages: 0,
    usedInTemplates: 0,
    ...overrides,
  };
}

const serviceTemplate = section({ id: 'service', name: 'Scheda servizio' });
const articleTemplate = section({ id: 'article', name: 'Articolo blog' });

function renderDialog({
  sections = [serviceTemplate, articleTemplate],
  collectionId = null,
  defaultTemplateId = null,
  onCreate = vi.fn<(input: NewPageGroupInput) => Promise<unknown>>(() =>
    Promise.resolve(),
  ),
}: {
  /** A promise to hold the answer back, for what the dialog does while it waits. */
  sections?:
    | sectionsApi.ReusableSectionListItemDto[]
    | Promise<sectionsApi.ReusableSectionListItemDto[]>;
  collectionId?: string | null;
  defaultTemplateId?: string | null;
  onCreate?: (input: NewPageGroupInput) => Promise<unknown>;
} = {}) {
  vi.mocked(sectionsApi.listReusableSections).mockReturnValue(
    Promise.resolve(sections),
  );
  vi.mocked(collectionsApi.listCollections).mockResolvedValue([
    {
      id: 'news',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      name: 'News',
      icon: 'newspaper',
      order: 0,
      defaultTemplateId,
      createdAt: '',
      updatedAt: '',
    },
  ]);
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <NewPageGroupDialog
        siteId="site-1"
        collectionId={collectionId}
        open
        onOpenChange={vi.fn()}
        onCreate={onCreate}
      />
    </QueryClientProvider>,
  );
  return { onCreate };
}

function typeName(name: string) {
  fireEvent.change(screen.getByLabelText('Nome pagina'), {
    target: { value: name },
  });
}

describe('NewPageGroupDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('asks nothing about templates on a site that has none', async () => {
    const { onCreate } = renderDialog({ sections: [] });

    typeName('Chi siamo');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Crea' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }));

    expect(screen.queryByText('Parti da')).toBeNull();
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: 'Chi siamo',
        templateId: null,
      }),
    );
  });

  /*
   * Pressed before the templates have answered, Create would make a blank
   * page nobody chose — inside a collection whose default is a template.
   */
  it('keeps Create disabled until the templates and the collection have answered', async () => {
    let answerTemplates: (
      sections: sectionsApi.ReusableSectionListItemDto[],
    ) => void = () => undefined;
    renderDialog({
      collectionId: 'news',
      defaultTemplateId: 'article',
      sections: new Promise((resolve) => {
        answerTemplates = resolve;
      }),
    });

    typeName('Nuovo articolo');
    const create = screen.getByRole('button', { name: 'Crea' });
    expect(create.hasAttribute('disabled')).toBe(true);

    await act(async () => {
      answerTemplates([articleTemplate]);
    });

    await waitFor(() => expect(create.hasAttribute('disabled')).toBe(false));
    expect(screen.getByRole('combobox').textContent).toBe('Articolo blog');
  });

  it('offers only published templates — never a shared section, never a draft', async () => {
    renderDialog({
      sections: [
        serviceTemplate,
        section({ id: 'newsletter', name: 'Newsletter', kind: 'shared' }),
        section({
          id: 'unfinished',
          name: 'Bozza di template',
          status: 'draft',
          publishedContent: null,
        }),
      ],
    });

    fireEvent.click(await screen.findByRole('combobox'));

    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['Pagina vuota', 'Scheda servizio']);
  });

  it('starts blank on the Pages screen, and sends the template picked', async () => {
    const { onCreate } = renderDialog();

    const select = await screen.findByRole('combobox');
    expect(select.textContent).toBe('Pagina vuota');
    fireEvent.click(select);
    fireEvent.click(screen.getByRole('option', { name: 'Scheda servizio' }));
    typeName('Idraulico Milano');
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: 'Idraulico Milano',
        templateId: 'service',
      }),
    );
  });

  it("preselects the collection's default, and still lets the page start blank", async () => {
    const { onCreate } = renderDialog({
      collectionId: 'news',
      defaultTemplateId: 'article',
    });

    await waitFor(() =>
      expect(screen.getByRole('combobox').textContent).toBe('Articolo blog'),
    );
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Pagina vuota' }));
    typeName('Nuovo articolo');
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: 'Nuovo articolo',
        templateId: null,
      }),
    );
  });

  it('falls back to blank when the default is no longer on offer', async () => {
    renderDialog({ collectionId: 'news', defaultTemplateId: 'deleted' });

    await waitFor(() =>
      expect(collectionsApi.listCollections).toHaveBeenCalled(),
    );
    expect((await screen.findByRole('combobox')).textContent).toBe(
      'Pagina vuota',
    );
  });

  it('says a name is too long for an address before sending it', async () => {
    const { onCreate } = renderDialog({ sections: [] });

    typeName('x'.repeat(201));

    expect(
      await screen.findByText(
        'Il nome è troppo lungo per diventare un indirizzo: al massimo 200 caratteri.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Crea' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();
  });

  /*
   * A 400 is the request itself — a name too long to become an address,
   * say — and must not be blamed on the template that happens to be
   * selected.
   */
  it('does not blame the template for a request the server found malformed', async () => {
    renderDialog({
      onCreate: () =>
        Promise.reject(
          new ApiError(400, { message: 'slug must be at most 200 characters' }),
        ),
    });

    fireEvent.click(await screen.findByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Scheda servizio' }));
    typeName('Idraulico Milano');
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }));

    expect(
      await screen.findByText('slug must be at most 200 characters'),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Quel template non è più disponibile. Scegline un altro.',
      ),
    ).toBeNull();
  });

  it('says the template went away rather than printing the status', async () => {
    renderDialog({
      onCreate: () => Promise.reject(new ApiError(404, { message: 'gone' })),
    });

    fireEvent.click(await screen.findByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Scheda servizio' }));
    typeName('Idraulico Milano');
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }));

    expect(
      await screen.findByText(
        'Quel template non è più disponibile. Scegline un altro.',
      ),
    ).toBeTruthy();
  });
});
