import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { SegmentedTabs } from '../components/ui/segmented-tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

// The minimal shape every version record shares — a page group's, a page
// translation's, a layout section's. This dialog is presentational only
// (docs/adr/0018): it doesn't know or care which entity's versions it is
// showing, that's the caller's own hook (usePageVersions /
// useSiteLayoutSectionVersions) to fetch and pass in.
export interface VersionSummary {
  id: string;
  createdAt: string;
  /** Said beside the date — what restoring this version would do beyond the obvious, e.g. unlink a language again. */
  note?: string;
}

/**
 * One history the dialog can show. A page has two: its shared structure,
 * and the text of the language being edited — which is where an unlinked
 * language keeps its own tree, and where a relinked one keeps the fork it
 * let go of (docs/adr/0075).
 */
export interface VersionSource {
  key: string;
  /** Shown only when there is more than one source to choose between. */
  label: string;
  versions: VersionSummary[];
  isLoading: boolean;
  onRollback: (versionId: string) => Promise<unknown>;
}

export interface VersionHistoryDialogProps {
  sources: VersionSource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistoryDialog({
  sources,
  open,
  onOpenChange,
}: VersionHistoryDialogProps) {
  const { t, i18n } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Falls back to the first one when the selection is gone — switching to
  // an unlinked language takes the structure's history away.
  const source =
    sources.find((candidate) => candidate.key === selectedKey) ?? sources[0];

  async function handleRollback(versionId: string) {
    await source.onRollback(versionId);
    onOpenChange(false);
  }

  // Newest first; the API returns them oldest-first (see listByPage).
  const sorted = [...(source?.versions ?? [])].reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.versionHistory.title')}</DialogTitle>
          <DialogDescription>
            {t('pages.versionHistory.description')}
          </DialogDescription>
        </DialogHeader>
        {sources.length > 1 && (
          <SegmentedTabs
            tabs={sources.map((candidate) => ({
              value: candidate.key,
              label: candidate.label,
            }))}
            value={source.key}
            onChange={setSelectedKey}
          />
        )}
        {!source || source.isLoading ? (
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
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <span className="flex min-w-0 flex-col">
                  <span>
                    {new Date(version.createdAt).toLocaleString(i18n.language)}
                  </span>
                  {version.note && (
                    <span className="text-xs text-muted-foreground">
                      {version.note}
                    </span>
                  )}
                </span>
                {index === 0 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t('pages.versionHistory.current')}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
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
