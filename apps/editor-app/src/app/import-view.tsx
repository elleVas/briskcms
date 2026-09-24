import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { actionErrorMessage } from '../lib/http-client';
import { startWordPressAnalysis } from '../lib/imports-api-client';
import {
  importJobQueryOptions,
  importJobsQueryOptions,
} from './imports-queries';
import { ImportAnalysisReport } from './import-analysis-report';

export interface ImportViewProps {
  siteId: string;
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1_048_576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Bringing a site in from WordPress — which, for now, means being told
 * what would happen if you did.
 *
 * Reading first and importing never (yet) is the whole design, not a
 * missing half: every importer on the market brings content across
 * quietly and incompletely, and the thing worth having before any of
 * that is a number you can trust. See ADR-0082.
 */
export function ImportView({ siteId }: ImportViewProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [watchedJobId, setWatchedJobId] = useState<string | null>(null);

  const { data: jobs } = useQuery(importJobsQueryOptions(siteId));
  const { data: watched } = useQuery(importJobQueryOptions(watchedJobId));

  const upload = useMutation({
    mutationFn: (file: File) => startWordPressAnalysis(siteId, file),
    onSuccess: (job) => {
      setWatchedJobId(job.id);
      void queryClient.invalidateQueries({ queryKey: ['imports', 'list'] });
    },
    onError: (cause) =>
      setError(actionErrorMessage(cause, t('imports.failed'))),
  });

  // The newest attempt is what somebody wants to see on arrival, without
  // having to upload again to remember what the last one said.
  const shown = watched ?? jobs?.items[0] ?? null;

  function choose(file: File | undefined) {
    if (!file) return;
    setError('');
    upload.mutate(file);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('imports.title')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('imports.description')}
        </p>
      </div>

      <div className="border-border flex flex-col items-start gap-3 rounded-md border border-dashed p-6">
        <p className="text-sm">{t('imports.uploadHint')}</p>
        <input
          ref={fileInput}
          type="file"
          accept=".xml,text/xml,application/xml"
          className="sr-only"
          onChange={(event) => choose(event.target.files?.[0])}
        />
        <Button
          type="button"
          disabled={upload.isPending}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden="true" />
          {upload.isPending ? t('imports.uploading') : t('imports.choose')}
        </Button>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>

      {shown && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">{shown.fileName}</h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatBytes(shown.fileBytes)} ·{' '}
              {new Date(shown.createdAt).toLocaleString(i18n.language)}
            </span>
          </div>

          {shown.status === 'analyzing' && (
            <p role="status" className="text-muted-foreground text-sm">
              {t('imports.analyzing')}
            </p>
          )}
          {shown.status === 'failed' && (
            <p role="alert" className="text-destructive text-sm">
              {shown.failureReason ?? t('imports.failed')}
            </p>
          )}
          {shown.status === 'analyzed' && shown.report && (
            <ImportAnalysisReport report={shown.report} />
          )}
        </section>
      )}

      {jobs && jobs.items.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t('imports.history')}</h2>
          <ul className="border-border divide-y rounded-md border text-sm">
            {jobs.items.slice(1).map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  onClick={() => setWatchedJobId(job.id)}
                  className="hover:bg-muted flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                >
                  <span className="truncate">{job.fileName}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {new Date(job.createdAt).toLocaleDateString(i18n.language)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
