import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A plain `<select>`, styled to match `Input`.
 *
 * Not the Radix `Select` next door: that one is for a choice that wants a
 * custom-drawn menu, and it cannot hold an empty value. These are the
 * places where a native control is the right answer — the operating
 * system's own picker on a phone, type-ahead on a long list, and no
 * portal to position — and where the only thing missing was the styling.
 *
 * It exists because that styling was a hand-copied string: the form
 * field-type picker had it as a local constant, and the country picker
 * was about to have a second copy.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
