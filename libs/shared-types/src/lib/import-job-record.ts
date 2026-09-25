import { z } from 'zod';
import { wordPressAnalysisSchema } from './wordpress-import';

/** Where an import has got to (docs/adr/0082) — the one list the domain, the wire and the `import_job_status` enum read. */
export const IMPORT_JOB_STATUSES = ['analyzing', 'analyzed', 'failed'] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

/** One attempt at bringing a site in, as every `/imports` response carries it (docs/adr/0026). */
export const importJobRecordSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  /** `'wordpress'` today; a second source writes its own name. */
  source: z.string(),
  fileName: z.string(),
  fileBytes: z.number().int().nonnegative(),
  status: z.enum(IMPORT_JOB_STATUSES),
  /** Present once the reading has finished. */
  report: wordPressAnalysisSchema.nullable(),
  /** Present when it failed, and written to be read by whoever uploaded the file. */
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type ImportJobRecord = z.infer<typeof importJobRecordSchema>;

export const importJobListSchema = z.object({
  items: z.array(importJobRecordSchema),
});
export type ImportJobList = z.infer<typeof importJobListSchema>;
