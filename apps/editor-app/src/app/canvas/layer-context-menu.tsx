import { useEffect, useRef } from 'react';
import { Copy, MoveDown, MoveUp, Trash2 } from 'lucide-react';
import { useTranslation } from '../../lib/use-translation';

export interface LayerContextMenuProps {
  /** Where the pointer was, in viewport coordinates. */
  x: number;
  y: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
}

/**
 * The few things worth doing to a block without leaving the tree.
 *
 * Four, not everything the toolbar offers: a context menu that lists
 * every action is a second toolbar with worse discoverability. These are
 * the ones that are about a block's place in the tree, which is what the
 * tree is for — styling and content stay where they already are.
 *
 * It is not a replacement for the canvas toolbar. It is the way to reach
 * a block the canvas cannot give you: one that renders to nothing gets a
 * placeholder now, but one scrolled far out of view, or buried three
 * containers deep, is still easier to reach here.
 */
export function LayerContextMenu({
  x,
  y,
  canMoveUp,
  canMoveDown,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onClose,
}: LayerContextMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Anything that is not a click on the menu closes it — including a
    // scroll, which would otherwise leave it floating over a row it no
    // longer belongs to.
    function dismiss(event: Event) {
      if (event.target instanceof Node && ref.current?.contains(event.target)) {
        return;
      }
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('scroll', dismiss, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('scroll', dismiss, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const items = [
    {
      key: 'duplicate',
      label: t('canvas.duplicateBlock'),
      icon: Copy,
      run: onDuplicate,
      enabled: true,
    },
    {
      key: 'moveUp',
      label: t('canvas.moveUp'),
      icon: MoveUp,
      run: onMoveUp,
      enabled: canMoveUp,
    },
    {
      key: 'moveDown',
      label: t('canvas.moveDown'),
      icon: MoveDown,
      run: onMoveDown,
      enabled: canMoveDown,
    },
    {
      key: 'delete',
      label: t('canvas.removeBlock'),
      icon: Trash2,
      run: onDelete,
      enabled: true,
      destructive: true,
    },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t('canvas.layersTitle')}
      className="fixed z-50 min-w-40 rounded-md border bg-popover p-1 shadow-md"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={!item.enabled}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-40 ${
            item.destructive
              ? 'text-destructive hover:bg-destructive/10'
              : 'hover:bg-muted'
          }`}
          onClick={() => {
            item.run();
            onClose();
          }}
        >
          <item.icon size={14} className="shrink-0" aria-hidden />
          {item.label}
        </button>
      ))}
    </div>
  );
}
