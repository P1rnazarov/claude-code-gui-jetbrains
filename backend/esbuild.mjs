import { build } from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

// ─── Build-time env injection ───────────────────────────────────────────────
// Build-time injection is opt-in via a leading underscore: only root-.env keys
// named `_FOO` are baked into the bundle. scripts/build.sh (and the gradle
// buildNodeBackend task) collect those `_`-prefixed key names into
// BUILD_INJECT_KEYS, so esbuild replaces `process.env._FOO` with the literal
// value. Plain keys stay runtime-only; nothing unrelated (PATH etc.) is swept in.
const injectKeys = (process.env.BUILD_INJECT_KEYS ?? '')
  .split(/\s+/)
  .filter(Boolean);

const injectedDefine = Object.fromEntries(
  injectKeys.map((key) => [
    `process.env.${key}`,
    JSON.stringify(process.env[key] ?? ''),
  ]),
);

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/backend.mjs',
  sourcemap: true,
  minify: false,
  external: [],
  define: {
    '__PLUGIN_VERSION__': JSON.stringify(pkg.version),
    // Keys defined in the root .env, injected at build time — never committed
    // as source constants.
    ...injectedDefine,
  },
  banner: {
    js: `import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);`,
  },
});

console.log('Backend bundled successfully');
