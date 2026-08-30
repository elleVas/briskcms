import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../icon-button';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

/** `undefined` = piena larghezza (comportamento di sempre) — solo tablet/mobile impongono una larghezza fissa all'iframe, vedi canvas-frame.tsx. */
export const BREAKPOINT_WIDTHS: Record<Breakpoint, number | undefined> = {
  desktop: undefined,
  tablet: 768,
  mobile: 375,
};

export interface BreakpointSelectorProps {
  value: Breakpoint;
  onChange: (value: Breakpoint) => void;
}

export function BreakpointSelector({
  value,
  onChange,
}: BreakpointSelectorProps) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('canvas.breakpointGroup')}
      className="flex items-center gap-0.5"
    >
      <IconButton
        label={t('canvas.breakpointDesktop')}
        variant={value === 'desktop' ? 'secondary' : 'ghost'}
        aria-pressed={value === 'desktop'}
        onClick={() => onChange('desktop')}
      >
        <Monitor />
      </IconButton>
      <IconButton
        label={t('canvas.breakpointTablet')}
        variant={value === 'tablet' ? 'secondary' : 'ghost'}
        aria-pressed={value === 'tablet'}
        onClick={() => onChange('tablet')}
      >
        <Tablet />
      </IconButton>
      <IconButton
        label={t('canvas.breakpointMobile')}
        variant={value === 'mobile' ? 'secondary' : 'ghost'}
        aria-pressed={value === 'mobile'}
        onClick={() => onChange('mobile')}
      >
        <Smartphone />
      </IconButton>
    </div>
  );
}
