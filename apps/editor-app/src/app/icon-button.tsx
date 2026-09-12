import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';

export interface IconButtonProps extends ComponentProps<typeof Button> {
  label: string;
  /**
   * The key combination that does the same thing, shown in the tooltip.
   *
   * Deliberately not part of `aria-label`: the accessible name should be
   * what the button does, and a screen reader announcing "Undo ⌘Z" reads
   * the glyphs out. It is here because a tooltip is where somebody finds
   * out a shortcut exists at all — none of the app's strings mentioned one.
   */
  shortcut?: string;
  children: ReactNode;
}

export function IconButton({
  label,
  shortcut,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && (
          <kbd className="ml-1.5 rounded-sm bg-background/20 px-1 font-sans text-[0.6875rem]">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
