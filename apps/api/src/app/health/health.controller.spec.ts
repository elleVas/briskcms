import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DatabaseModule, DATABASE } from '../database.module';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let app: INestApplication;
  let fakeDb: { execute: (query: unknown) => Promise<unknown> };

  async function createApp(db: typeof fakeDb) {
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      controllers: [HealthController],
    })
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();

    const nestApp = moduleRef.createNestApplication();
    await nestApp.init();
    return nestApp;
  }

  afterEach(async () => {
    await app.close();
  });

  it('returns ok when the database round-trip succeeds', async () => {
    fakeDb = { execute: () => Promise.resolve([{ '?column?': 1 }]) };
    app = await createApp(fakeDb);

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('returns 503 when the database is unreachable', async () => {
    fakeDb = {
      execute: () => Promise.reject(new Error('connection refused')),
    };
    app = await createApp(fakeDb);

    await request(app.getHttpServer()).get('/health').expect(503);
  });
});
