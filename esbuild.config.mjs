import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isProd = process.argv.includes('--prod');

const config = {
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: 'dist/index.js',
  format: 'cjs',
  sourcemap: false,
  minify: isProd,
  minifyWhitespace: true,
  minifyIdentifiers: isProd, // Minify identifiers in production
  minifySyntax: true,
  treeShaking: true,
  drop: isProd ? ['debugger'] : [],
  legalComments: 'none',
  // Native modules that can't be bundled
  external: [
    'better-sqlite3',
    'talib',
    'protobufjs',
    'protobufjs/minimal',
    'protobufjs/minimal.js',
    'ts-node',
    'ts-node/register',
    'tsconfig-paths',
    'tsconfig-paths/register',
    'fsevents',
  ],
  define: {
    'process.env.NODE_ENV': isProd ? '"production"' : '"development"',
  },
  logLevel: 'warning',
  mainFields: ['module', 'main'],
  conditions: ['node'],
  ignoreAnnotations: true,
  keepNames: true,
  // Mark these as pure for better tree-shaking
  pure: [
    'console.debug',
    'console.trace',
  ],
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(config);
}
