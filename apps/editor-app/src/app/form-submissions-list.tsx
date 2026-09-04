import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import type { FormField } from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import type { FormSubmissionDto } from '../lib/forms-api-client';
import { formSubmissionsCsvUrl } from '../lib/forms-api-client';
import {
  FORM_SUBMISSIONS_PAGE_SIZE,
  formSubmissionsQueryOptions,
} from './forms-queries';

/** A file answer's stored shape — `{ url, filename }`, not a string. */
function asFile(value: unknown): { url: string; filename?: string } | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { url?: unknown; filename?: unknown };
  return typeof candidate.url === 'string'
    ? {
        url: candidate.url,
        filename:
          typeof candidate.filename === 'string'
            ? candidate.filename
            : undefined,
      }
    : null;
}

/**
 * An answer as one line of text, for the collapsed row's preview. It has
 * to go through the same shapes `AnswerValue` handles: a file answer put
 * through `String()` reads "[object Object]", which is the same trap the
 * notification email and the CSV export each hit once.
 */
function previewText(value: unknown): string | null {
  const file = asFile(value);
  if (file) return file.filename ?? file.url;
  if (typeof value === 'boolean') return null;
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

/**
 * One answer, in whatever shape the field's type stored it. A booleanish
 * checkbox reads as yes/no rather than `true`, and a blank reads as a dash
 * rather than as nothing at all — an empty cell is ambiguous between "left
 * blank" and "the UI failed to render it".
 */
function AnswerValue({ value }: { value: unknown }) {
  const { t } = useTranslation();
  const file = asFile(value);

  if (file) {
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline"
      >
        <Download className="size-3.5" aria-hidden="true" />
        {file.filename ?? t('forms.submissions.downloadFile')}
      </a>
    );
  }
  if (typeof value === 'boolean') {
    return <>{value ? t('common.yes') : t('common.no')}</>;
  }
  if (value === null || value === undefined || value === '') {
    return (
      <span className="text-muted-foreground">
        {t('forms.submissions.noAnswer')}
      </span>
    );
  }
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

interface SubmissionRowProps {
  submission: FormSubmissionDto;
  fields: FormField[];
  locale: string;
}

function SubmissionRow({ submission, fields, locale }: SubmissionRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const knownIds = fields.map((field) => field.id);
  // Answers to fields the form no longer has. They are real things someone
  // typed, so they are shown — labelled by their raw key, which is the only
  // name left for them, and marked so nobody mistakes one for a live field.
  const orphanKeys = Object.keys(submission.payload).filter(
    (key) => !knownIds.includes(key),
  );

  const preview = fields
    .slice(0, 2)
    .map((field) => previewText(submission.payload[field.id]))
    .filter((text): text is string => text !== null)
    .join(' · ');

  return (
    <li className="border-border border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        className="hover:bg-muted/40 flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        )}
        <time
          dateTime={submission.createdAt}
          className="text-muted-foreground w-40 shrink-0 text-xs tabular-nums"
        >
          {new Date(submission.createdAt).toLocaleString(locale)}
        </time>
        <span className="truncate text-sm">
          {preview || t('forms.submissions.noAnswer')}
        </span>
        <span className="sr-only">
          {open
            ? t('forms.submissions.collapse')
            : t('forms.submissions.expand')}
        </span>
      </button>

      {open && (
        <dl className="grid gap-x-4 gap-y-2 px-3 pb-4 pl-10 text-sm sm:grid-cols-[12rem_1fr]">
          {fields.map((field) => (
            <div key={field.id} className="contents">
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd>
                <AnswerValue value={submission.payload[field.id]} />
              </dd>
            </div>
          ))}
          {orphanKeys.map((key) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">
                {key}{' '}
                <span className="text-xs italic">
                  ({t('forms.submissions.removedField')})
                </span>
              </dt>
              <dd>
                <AnswerValue value={submission.payload[key]} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

export interface FormSubmissionsListProps {
  formId: string;
}

/**
 * What was actually submitted to this form. Lives inside the form's own
 * editor because a payload is keyed by field id and means nothing without
 * that form's field definitions to read it against.
 *
 * A list of expandable rows rather than a table with a column per field:
 * a three-field contact form would read fine as a table, a fifteen-field
 * one would not, and neither shape has anywhere to put an answer to a
 * field that has since been removed.
 */
export function FormSubmissionsList({ formId }: FormSubmissionsListProps) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = useQuery(
    formSubmissionsQueryOptions(formId, page),
  );

  if (isPending) {
    return (
      <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t('forms.submissions.loadError')}
      </p>
    );
  }

  const lastPage = Math.max(
    1,
    Math.ceil(data.total / FORM_SUBMISSIONS_PAGE_SIZE),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold">
            {t('forms.submissions.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('forms.submissions.count', { count: data.total })}
          </p>
        </div>
        {data.total > 0 && (
          <Button asChild variant="outline" size="sm">
            {/* A real link, not a fetch: the browser has to do the request
                itself for the save dialog to appear. The session cookie
                goes with it. */}
            <a href={formSubmissionsCsvUrl(formId)} download>
              {t('forms.submissions.exportCsv')}
            </a>
          </Button>
        )}
      </div>

      {data.total === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          {t('forms.submissions.empty')}
        </p>
      ) : (
        <ul className="border-border overflow-hidden rounded-md border">
          {data.items.map((submission) => (
            <SubmissionRow
              key={submission.id}
              submission={submission}
              fields={data.fields}
              locale={i18n.language}
            />
          ))}
        </ul>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
          >
            {t('forms.submissions.previousPage')}
          </Button>
          <span className="text-muted-foreground text-sm tabular-nums">
            {page} / {lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('forms.submissions.nextPage')}
          </Button>
        </div>
      )}
    </div>
  );
}
