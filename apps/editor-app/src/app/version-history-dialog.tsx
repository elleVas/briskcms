import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';
import { usePageVersions } from './use-page-versions.js';

export interface VersionHistoryDialogProps {
  pageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}

export function VersionHistoryDialog({
  pageId,
  open,
  onOpenChange,
  onRestored,
}: VersionHistoryDialogProps) {
  const { t, i18n } = useTranslation();
  const { versions, isLoading, rollback } = usePageVersions(pageId, open);

  async function handleRollback(versionId: string) {
    await rollback(versionId);
    onRestored();
    onOpenChange(false);
  }

  // Newest first; the API returns them oldest-first (see listByPage).
  const sorted = [...versions].reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.versionHistory.title')}</DialogTitle>
          <DialogDescription>
            {t('pages.versionHistory.description')}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('pages.versionHistory.empty')}
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {sorted.map((version, index) => (
              <li
                key={version.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
              >
                <span>
                  {new Date(version.createdAt).toLocaleString(i18n.language)}
                </span>
                {index === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t('pages.versionHistory.current')}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRollback(version.id)}
                  >
                    {t('pages.versionHistory.restore')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
