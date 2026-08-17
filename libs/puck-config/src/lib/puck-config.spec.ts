import { puckConfig } from './puck-config.js';

describe('puckConfig', () => {
  it('should work', () => {
    expect(puckConfig()).toEqual('puck-config');
  });
});
