import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from '../lib/use-translation';
import { setPageGroupTerms } from '../lib/taxonomies-api-client';
import {
  pageGroupTermsQueryOptions,
  taxonomiesQueryOptions,
  termsQueryOptions,
} from './taxonomies-queries';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { firstNamed } from './taxonomies-view';

export interface PageGroupTermsDialogProps {
  groupId: string;
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * What this page is filed under, across every dimension at once
 * (docs/adr/0064).
 *
 * On the page GROUP and not on the translation, which is why this dialog
 * says so out loud: the Italian and the English version of an article
 * are the same article, and ticking a box here changes both.
 *
 * Each tick saves immediately — the whole set, not a diff, because that
 * is what the API takes and what the editor actually knows: the boxes
 * that are ticked.
 */
export function PageGroupTermsDialog({
  groupId,
  siteId,
  open,
  onOpenChange,
}: PageGroupTermsDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: taxonomies = [] } = useQuery({
    ...taxonomiesQueryOptions(siteId),
    enabled: open,
  });
  const termQueries = useQueries({
    queries: taxonomies.map((taxonomy) => ({
      ...termsQueryOptions(taxonomy.id),
      enabled: open,
    })),
  });
  const assignedOptions = pageGroupTermsQueryOptions(groupId);
  const { data: assigned } = useQuery({ ...assignedOptions, enabled: open });
  const termIds = assigned?.termIds ?? [];

  const saveMutation = useMutation({
    mutationFn: (next: string[]) => setPageGroupTerms(groupId, next),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: assignedOptions.queryKey,
      }),
  });

  function toggle(termId: string) {
    saveMutation.mutate(
      termIds.includes(termId)
        ? termIds.filter((id) => id !== termId)
        : [...termIds, termId],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('taxonomies.pageTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('taxonomies.pageHint')}
        </p>
        {taxonomies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('taxonomies.pageEmpty')}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {taxonomies.map((taxonomy, index) => (
              <fieldset key={taxonomy.id} className="flex flex-col gap-1.5">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {firstNamed(taxonomy.name) || t('taxonomies.unnamed')}
                </legend>
                {(termQueries[index]?.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('taxonomies.noTerms')}
                  </p>
                ) : (
                  (termQueries[index]?.data ?? []).map((term) => (
                    <label
                      key={term.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={termIds.includes(term.id)}
                        onChange={() => toggle(term.id)}
                      />
                      {firstNamed(term.name) || t('taxonomies.unnamed')}
                    </label>
                  ))
                )}
              </fieldset>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
