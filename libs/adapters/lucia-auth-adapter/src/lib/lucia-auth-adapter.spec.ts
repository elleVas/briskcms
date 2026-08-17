import { luciaAuthAdapter } from './lucia-auth-adapter.js';

describe('luciaAuthAdapter', () => {
  it('should work', () => {
    expect(luciaAuthAdapter()).toEqual('lucia-auth-adapter');
  });
});
