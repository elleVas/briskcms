import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';

// Minimal shape shared by PageVersionRecord and SiteLayoutSectionVersionDto —
// this dialog is presentational only (docs/adr/0018): it doesn't know or
// care which entity's versions it's showing, that's the caller's own hook
// (usePageVersions / useSiteLayoutSectionVersions) to fetch and pass in.
export interface VersionSummary {
  id: string;
  createdAt: string;
}

export interface VersionHistoryDialogProps {
  versions: VersionSummary[];
  isLoading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRollback: (versionId: string) => Promise<unknown>;
}

export function VersionHistoryDialog({
  versions,
  isLoading,
  open,
  onOpenChange,
  onRollback,
}: VersionHistoryDialogProps) {
  const { t, i18n } = useTranslation();

  async function handleRollback(versionId: string) {
    await onRollback(versionId);
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
