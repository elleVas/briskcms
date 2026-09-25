import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { tmpdir } from 'node:os';
import {
  getImportJob,
  listImportJobs,
  runWordPressAnalysis,
  startWordPressAnalysis,
} from '@brisk/application';
import type { ImportJob } from '@brisk/domain-core';
import type {
  ImportJobRepositoryPort,
  SiteRepositoryPort,
  TenantContextPort,
  WordPressExportReaderPort,
} from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  IMPORT_JOB_REPOSITORY,
  SITE_REPOSITORY,
  WORDPRESS_EXPORT_READER,
} from './imports.tokens';
import {
  type ListImportJobsQuery,
  listImportJobsQuerySchema,
  type StartWordPressAnalysisBody,
  startWordPressAnalysisBodySchema,
} from './imports.schemas';

/**
 * 512 MB.
 *
 * The plan said 200; the first real client site exports **314 MB** — an
 * ordinary WooCommerce shop, not an outlier — and would have been turned
 * away at the door. Nothing here loads the file, so the ceiling is about
 * disk and patience rather than memory: the reader streams it in 28 MB
 * of heap whatever its size.
 */
const MAX_EXPORT_BYTES = 512 * 1024 * 1024;

/** Where an upload lands until it has been read. Chosen here, so the paths below are this file's own. */
const UPLOAD_DIRECTORY = tmpdir();

function toDto(job: ImportJob) {
  const props = job.toProps();
  return {
    id: props.id,
    siteId: props.siteId,
    source: props.source,
    fileName: props.fileName,
    fileBytes: props.fileBytes,
    status: props.status,
    report: props.report,
    failureReason: props.failureReason,
    createdAt: props.createdAt.toISOString(),
    finishedAt: props.finishedAt?.toISOString() ?? null,
  };
}

@Controller('imports')
@UseGuards(SessionAuthGuard)
export class ImportsController {
  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepositoryPort,
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
    @Inject(WORDPRESS_EXPORT_READER)
    private readonly exportReader: WordPressExportReaderPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  /**
   * Takes an export and answers with the job that will read it — 202,
   * because reading 314 MB takes seconds and because the answer is meant
   * to be read and thought about, not returned.
   */
  @Post('wordpress/analysis')
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor('file', {
      // On disk, not in memory: `memoryStorage` would hold the whole
      // export as a Buffer, which is the one thing the streaming reader
      // exists to avoid.
      //
      // The name is ours, not the uploader's. Multer happens to generate
      // a random one when asked for nothing, but that is an undocumented
      // default of somebody else's library — and what this handler does
      // with the path is read it and then `unlink` it, so the day that
      // default changes to keep the original name is the day an upload
      // called `../../etc/something` deletes it.
      storage: diskStorage({
        destination: UPLOAD_DIRECTORY,
        filename: (_request, _file, done) =>
          done(null, `brisk-import-${randomUUID()}.xml`),
      }),
      limits: { fileSize: MAX_EXPORT_BYTES },
    }),
  )
  async analyzeWordPress(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(startWordPressAnalysisBodySchema))
    body: StartWordPressAnalysisBody,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Built from the directory this controller chose and the bare name
    // multer wrote, never from `file.path` as handed over: `basename`
    // drops any directory part, and the join anchors what is left inside
    // the upload directory. Belt and braces over the `filename` callback
    // above, and the part a reader can check without leaving this file.
    const filePath = join(UPLOAD_DIRECTORY, basename(file.filename));

    const tenantId = this.tenantContext.getCurrentTenantId();
    const job = await startWordPressAnalysis(this.deps(), {
      tenantId,
      siteId: body.siteId,
      filePath,
      fileName: file.originalname,
      fileBytes: file.size,
      createdBy: null,
    });

    // Detached on purpose (docs/adr/0082): in-process, no queue, the
    // editor polls `GET /imports/:id`. `void` and not `await` is the
    // whole point — and the file is deleted whichever way it goes,
    // because it is not kept and a temp directory is not a store.
    void runWordPressAnalysis(this.deps(), {
      tenantId,
      jobId: job.id,
      filePath,
    }).finally(() => unlink(filePath).catch(() => undefined));

    return toDto(job);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const job = await getImportJob(
      { importJobRepository: this.importJobRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), jobId: id },
    );
    return toDto(job);
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listImportJobsQuerySchema))
    query: ListImportJobsQuery,
  ) {
    const jobs = await listImportJobs(
      { importJobRepository: this.importJobRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
      },
    );
    return { items: jobs.map(toDto) };
  }

  private deps() {
    return {
      importJobRepository: this.importJobRepository,
      siteRepository: this.siteRepository,
      exportReader: this.exportReader,
    };
  }
}
