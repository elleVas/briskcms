const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@brisk/api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // node_modules is not transformed by default, and `sanitize-html`
  // (@brisk/rich-text, ADR-0046) reaches htmlparser2, which ships ESM
  // only — Jest runs CJS here and chokes on its `import`.
  //
  // The pattern matches the whole PATH rather than the package directory
  // on purpose. Under pnpm the same file is reachable as
  // `.pnpm/sanitize-html@x/node_modules/htmlparser2/...` through a
  // symlink, and a pattern anchored on `.pnpm/htmlparser2@` misses that
  // spelling and silently ignores the file after all — which is exactly
  // what happened before this comment existed.
  transformIgnorePatterns: [
    'node_modules/(?!.*(htmlparser2|entities|domutils|domhandler|domelementtype|dom-serializer))',
  ],
  coverageDirectory: 'test-output/jest/coverage',
  // Default (babel/istanbul) coverage attributes phantom branches to every
  // decorated class: SWC's legacyDecorator transform inlines a `__decorate`
  // polyfill per file whose own internal ternary (`arguments.length < 3 ? …`)
  // gets source-mapped back onto the decorated file, past its real EOF, as
  // an uncoverable branch no test could ever hit. The v8 provider reads
  // real V8 bytecode coverage instead of istanbul's synthesized branchMap,
  // so it isn't fooled by injected helper code — same provider already used
  // by every Vitest project in this workspace.
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/main.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 60,
      functions: 60,
      lines: 60,
    },
  },
};
