const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  // @node-rs/argon2 resolves its platform-specific native binding (e.g.
  // @node-rs/argon2-darwin-arm64) via a dynamic require() built from
  // process.platform/arch, not a static import specifier — webpack can't
  // trace that at build time and, left alone, tries to parse the .node
  // binary itself as JS and fails. node-loader tells webpack to treat
  // .node files as an opaque binary asset instead.
  module: {
    rules: [{ test: /\.node$/, loader: 'node-loader' }],
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    }),
  ],
};
