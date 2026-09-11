import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@brisk/shared-types';
import { createTestQueryClient } from '../../test-query-client';
import { ToastProvider } from '../toast-provider';
import { useSelectedBlockEditing } from './use-selected-block-editing';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

/*
 * A block's own style reaches the canvas as a RULE in the editor's style
 * sheet, not through its fragment. The sheet was built from the draft ref,
 * which only catches up after the next render: every style edit sent the
 * sheet as it was before that edit.
 */
describe('useSelectedBlockEditing', () => {
  it('sends the style sheet built from the tree WITH the style just set', () => {
    const block: Block = { id: 'h1', type: 'Heading', props: {} };
    const tree = [block];
    const refresh = vi.fn<(tree?: Block[]) => void>();
    const { result } = renderHook(
      () =>
        useSelectedBlockEditing({
          siteId: undefined,
          selectedBlock: block,
          selectedDescriptor: undefined,
          breakpoint: 'base',
          styleSheet: { refresh, replaceTypeCss: vi.fn() },
          localBlocksRef: { current: tree },
          setLocalBlocks: vi.fn(),
          onChange: vi.fn(),
          patch: {
            scheduleChange: vi.fn(),
            scheduleVariantChange: vi.fn(),
            scheduleStyleOverrideChange: vi.fn(),
          },
        }),
      { wrapper },
    );

    act(() =>
      result.current.handleChangeStyleOverride({ textColor: '#ff0000' }),
    );

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0][0]).toEqual([
      { ...block, styleOverride: { base: { textColor: '#ff0000' } } },
    ]);
  });
});
