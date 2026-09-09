import type { Request } from 'express';
import {
  PUBLIC_API_SERVICE_TOKEN_HEADER,
  PUBLIC_API_VISITOR_IP_HEADER,
} from '@brisk/shared-types';
import { PublicPagesThrottlerGuard } from './public-pages-throttler.guard';

/**
 * The guard's one job: decide WHOSE bucket a request spends. Constructed
 * bare — `getTracker` reads only the request and the environment, and
 * standing up Nest's whole throttler machinery to check that would test
 * the framework rather than this decision.
 */
type Trackable = { getTracker: (req: Request) => Promise<string> };
const guard = () =>
  Object.create(PublicPagesThrottlerGuard.prototype) as Trackable &
    PublicPagesThrottlerGuard;

function request(headers: Record<string, string>, ip = '10.0.0.9'): Request {
  return { headers, ip } as unknown as Request;
}

const SERVICE_TOKEN = 'a-real-deployment-secret-of-some-length';
const VISITOR = '203.0.113.7';

describe('PublicPagesThrottlerGuard', () => {
  const original = process.env['PUBLIC_API_SERVICE_TOKEN'];
  beforeEach(() => {
    process.env['PUBLIC_API_SERVICE_TOKEN'] = SERVICE_TOKEN;
  });
  afterEach(() => {
    if (original === undefined) delete process.env['PUBLIC_API_SERVICE_TOKEN'];
    else process.env['PUBLIC_API_SERVICE_TOKEN'] = original;
  });

  it('counts the visitor when this deployment’s own site vouches for them', async () => {
    const tracker = await (guard() as Trackable).getTracker(
      request({
        [PUBLIC_API_SERVICE_TOKEN_HEADER]: SERVICE_TOKEN,
        [PUBLIC_API_VISITOR_IP_HEADER]: VISITOR,
      }),
    );
    expect(tracker).toBe(VISITOR);
  });

  it('ignores an address nobody vouched for', async () => {
    // The API answers on a public hostname. Believing this header
    // unauthenticated would let anyone pick a fresh bucket per request
    // and never be limited at all.
    const tracker = await (guard() as Trackable).getTracker(
      request({ [PUBLIC_API_VISITOR_IP_HEADER]: VISITOR }),
    );
    expect(tracker).not.toBe(VISITOR);
  });

  it('ignores an address vouched for with the wrong token', async () => {
    const tracker = await (guard() as Trackable).getTracker(
      request({
        [PUBLIC_API_SERVICE_TOKEN_HEADER]: 'not-the-secret',
        [PUBLIC_API_VISITOR_IP_HEADER]: VISITOR,
      }),
    );
    expect(tracker).not.toBe(VISITOR);
  });

  it('does not throw on a token of a different length, which would leak it', async () => {
    await expect(
      (guard() as Trackable).getTracker(
        request({
          [PUBLIC_API_SERVICE_TOKEN_HEADER]: 'x',
          [PUBLIC_API_VISITOR_IP_HEADER]: VISITOR,
        }),
      ),
    ).resolves.toBeDefined();
  });

  it('trusts nothing when the deployment configured no token', async () => {
    delete process.env['PUBLIC_API_SERVICE_TOKEN'];
    const tracker = await (guard() as Trackable).getTracker(
      request({
        [PUBLIC_API_SERVICE_TOKEN_HEADER]: '',
        [PUBLIC_API_VISITOR_IP_HEADER]: VISITOR,
      }),
    );
    expect(tracker).not.toBe(VISITOR);
  });
});
