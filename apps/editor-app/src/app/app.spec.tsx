import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from './app';
import * as api from '../lib/pages-api-client.js';

vi.mock('../lib/pages-api-client.js');

const samplePage: api.PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  locale: 'it',
  slug: 'test-page',
  status: 'draft',
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Test', description: 'desc' },
  createdAt: '',
  updatedAt: '',
};

describe('App', () => {
  it('shows a loading state before the page has loaded', () => {
    vi.mocked(api.createPage).mockReturnValue(new Promise(() => undefined));

    render(<App />);

    expect(screen.getByText('Caricamento...')).toBeTruthy();
  });

  it('creates a page and renders the editor once it loads', async () => {
    vi.mocked(api.createPage).mockResolvedValue(samplePage);

    render(<App />);

    await waitFor(() =>
      expect(screen.queryByText('Caricamento...')).toBeNull(),
    );
    expect(api.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: expect.any(String) }),
    );
  });
});
