import { postgresPageRepository } from './postgres-page-repository.js';

describe('postgresPageRepository', () => {
  it('should work', () => {
    expect(postgresPageRepository()).toEqual('postgres-page-repository');
  });
});
