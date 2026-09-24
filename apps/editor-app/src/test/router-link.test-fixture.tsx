import type { ReactNode } from 'react';

/**
 * A stand-in for TanStack Router's `Link`, for specs that render one
 * component rather than a route.
 *
 * `Link` calls `useLinkProps`, which needs a real router context — there
 * is none in a component-only render, and the component throws. Nine
 * specs had each written their own copy of this before it lived here;
 * they differed in small ways (one handled `params`, most did not), which
 * is exactly how a duplicated helper goes wrong.
 *
 * Used from inside a `vi.mock` factory, which is hoisted above the
 * imports and so cannot close over one:
 *
 * ```ts
 * vi.mock('@tanstack/react-router', async (importOriginal) => ({
 *   ...(await importOriginal<typeof import('@tanstack/react-router')>()),
 *   Link: (await import('../test/router-link.test-fixture')).StubLink,
 * }));
 * ```
 */
export function StubLink({
  children,
  to,
  params,
  className,
}: {
  children: ReactNode;
  to: string;
  /** `/page-groups/$groupId` + `{ groupId: 'g1' }` renders as `/page-groups/g1`, so a spec can assert on the href it would really produce. */
  params?: Record<string, string>;
  className?: string;
}) {
  const href = Object.entries(params ?? {}).reduce(
    (path, [name, value]) => path.replace(`$${name}`, value),
    to,
  );
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
