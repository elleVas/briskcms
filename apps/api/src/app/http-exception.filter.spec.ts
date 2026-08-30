import { Logger, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { PageNotFoundError } from '@brisk/domain-core';
import { HttpExceptionFilter } from './http-exception.filter';
import type { RequestWithId } from './request-id.middleware';

function buildHost(request: Partial<RequestWithId>) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes an already-thrown HttpException through unchanged, with the request id attached', () => {
    const { host, status, json } = buildHost({
      requestId: 'req-1',
      method: 'GET',
      originalUrl: '/pages/missing',
    });

    filter.catch(new NotFoundException('Page not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Page not found',
        requestId: 'req-1',
      }),
    );
  });

  it('maps a known domain error to its HTTP status via the shared mapping table', () => {
    const { host, status, json } = buildHost({
      requestId: 'req-2',
      method: 'GET',
      originalUrl: '/pages/abc',
    });

    filter.catch(new PageNotFoundError('abc'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        requestId: 'req-2',
      }),
    );
  });

  it('falls back to a 500 for an error the mapping table does not know', () => {
    const { host, status, json } = buildHost({
      requestId: 'req-3',
      method: 'POST',
      originalUrl: '/pages',
    });

    filter.catch(new Error('db exploded'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, requestId: 'req-3' }),
    );
  });

  it('logs a 5xx as an error, with the stack trace and the request id in the message', () => {
    const { host } = buildHost({
      requestId: 'req-4',
      method: 'POST',
      originalUrl: '/pages',
    });
    const error = new Error('db exploded');

    filter.catch(error, host);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('req-4'),
      error.stack,
    );
  });

  it('logs a 4xx as a warning, not an error — expected client mistakes should not page anyone', () => {
    const { host } = buildHost({
      requestId: 'req-5',
      method: 'GET',
      originalUrl: '/pages/missing',
    });

    filter.catch(new PageNotFoundError('missing'), host);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('req-5'));
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
