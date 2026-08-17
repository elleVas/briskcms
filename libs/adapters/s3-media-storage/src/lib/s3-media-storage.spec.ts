import { s3MediaStorage } from './s3-media-storage.js';

describe('s3MediaStorage', () => {
  it('should work', () => {
    expect(s3MediaStorage()).toEqual('s3-media-storage');
  });
});
