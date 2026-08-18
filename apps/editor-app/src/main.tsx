import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import './i18n';
import './styles.css';
import { ApiError } from './lib/http-client.js';
import { routeTree } from './routeTree.gen';

// Retrying a 401 can't succeed — it means "you're not logged in", not "the
// network hiccuped" — and every guarded route loader is waiting on this
// query to reject before it can redirect to /login (see
// routes/require-auth.ts), so retrying it would only delay that redirect.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status === 401) {
    return false;
  }
  return failureCount < 3;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry },
    mutations: { retry: shouldRetry },
  },
});
const router = createRouter({ routeTree, context: { queryClient } });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
