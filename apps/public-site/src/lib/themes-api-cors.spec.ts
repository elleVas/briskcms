import { describe, expect, it } from 'vitest';
import { themesApiCorsHeaders } from './themes-api-cors.js';

describe('themesApiCorsHeaders', () => {
  it('allows only GET/OPTIONS and only the editor-app origin', () => {
    const headers = themesApiCorsHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBe(
      'http://localhost:4200',
    );
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
  });
});
