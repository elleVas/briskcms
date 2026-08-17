import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthModule } from './auth.module.js';

// Not an integration test: SessionAuthAdapter/DrizzleUserRepository's
// DATABASE dependency constructs a postgres.js client, which connects
// lazily — compiling the module never opens a socket (see
// libs/adapters/postgres-db/src/lib/client.spec.ts for that same guarantee
// at the source).
describe('AuthModule', () => {
  const originalValue = process.env.DEFAULT_TENANT_ID;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.DEFAULT_TENANT_ID;
    } else {
      process.env.DEFAULT_TENANT_ID = originalValue;
    }
  });

  it('wires up the module graph and resolves AuthController', async () => {
    process.env.DEFAULT_TENANT_ID = 'tenant-1';

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    expect(moduleRef.get(AuthController)).toBeInstanceOf(AuthController);
  });

  it('fails fast when DEFAULT_TENANT_ID is missing', async () => {
    delete process.env.DEFAULT_TENANT_ID;

    await expect(
      Test.createTestingModule({ imports: [AuthModule] }).compile(),
    ).rejects.toThrow(
      /Missing required environment variable: DEFAULT_TENANT_ID/,
    );
  });
});
