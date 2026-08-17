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
