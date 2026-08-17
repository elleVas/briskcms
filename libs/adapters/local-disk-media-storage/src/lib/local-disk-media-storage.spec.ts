import { localDiskMediaStorage } from './local-disk-media-storage.js';

describe('localDiskMediaStorage', () => {
  it('should work', () => {
    expect(localDiskMediaStorage()).toEqual('local-disk-media-storage');
  });
});
