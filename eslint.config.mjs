import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/.astro',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          // Every lib in this workspace is generated with --bundler=none on
          // purpose: none of them are published/consumed as pre-built
          // packages, they're TS source consumed directly by whichever
          // app's own bundler builds it (Vite, webpack, tsc, Astro). This
          // rule's premise (a "buildable" lib losing its non-buildable
          // dependency's source at publish time) doesn't apply here, and it
          // only fires inconsistently depending on which bundler an app
          // happens to use — see docs/adr/0008.
          enforceBuildableLibDependency: false,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          // Hexagonal layering (docs/adr — see also piano-progetto-astro-cms.md):
          // domain (pure entities and value objects) <- application (use
          // cases + ports) <- adapter (Drizzle/S3/SMTP/React field
          // descriptors...) <- app (the NestJS api, editor-app,
          // public-site). Each tag may depend only on itself and on those
          // to its left — never the other way round, and never one app on
          // another app (none of the three apps imports the others today,
          // verified).
          depConstraints: [
            {
              sourceTag: 'domain',
              onlyDependOnLibsWithTags: ['domain'],
            },
            {
              sourceTag: 'application',
              onlyDependOnLibsWithTags: ['domain', 'application'],
            },
            {
              sourceTag: 'adapter',
              onlyDependOnLibsWithTags: ['domain', 'application', 'adapter'],
            },
            {
              sourceTag: 'app',
              onlyDependOnLibsWithTags: ['domain', 'application', 'adapter'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
