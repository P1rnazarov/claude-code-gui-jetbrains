# Build-time Environment Injection

How build-time configuration (e.g. the telemetry API key) is baked into the
backend bundle from a single `.env` source, without committing it as a source
constant — and how that is kept distinct from runtime-injected values.

## Two kinds of env, one file

The repo-root `.env` holds both, distinguished by a naming convention:

| Kind | Convention | Where the value ends up |
|------|-----------|-------------------------|
| **Build-time bake-in** | leading underscore: `_FOO` | esbuild replaces `process.env._FOO` with the literal value inside `backend/dist/backend.mjs` |
| **Runtime** | no underscore: `FOO` | stays `process.env.FOO`; read at execution time from whatever the launcher (Kotlin spawn / `ccg`) injects |

The underscore is **opt-in**: only `_`-prefixed keys are baked in. Adding a plain
key to `.env` can never silently hard-code it into the bundle — and conversely, a
key that must be injected at runtime (e.g. `CCG_CLIENT_INFO`) must NOT get a `_`,
or it would be frozen to its build-time value and the runtime injection would be
dead.

## Single source of truth in code: `environment.ts`

`process.env` is referenced in **one place per layer**, which re-exports typed
constants:

- Backend: `backend/src/config/environment.ts`
- WebView: `webview/src/config/environment.ts`

For a bake-in key the single point reads `process.env._KEY` statically and exports
it under the underscore-stripped name:

```ts
// backend/src/config/environment.ts
export const CCG_RYBBIT_API_KEY = process.env._CCG_RYBBIT_API_KEY ?? '';
```

> esbuild's `define` only replaces the **exact static expression**
> `process.env._KEY`. Destructuring (`const { _KEY } = process.env`) or dynamic
> access (`process.env[name]`) is NOT replaced — keep the static form here.
>
> Exception: OS-discovery vars read by platform logic (e.g. `SHELL`, `LOCALAPPDATA`
> in `detectTerminals.ts` / `detectShell`) stay in their own module — they are not
> configuration, so they are out of scope for the single point.

## Channels

### `build.sh` (entry point for all builds)

`scripts/build.sh` (`load_env_file`) reads the root `.env`, exports every key into
`process.env` (so vite can read its prefixed subset), but collects only
`_`-prefixed key names into `BUILD_INJECT_KEYS` — the list esbuild bakes in.

It loads the environment-specific file first, then plain `.env` as a fallback,
never clobbering a value already set:

```
.env.<BUILD_ENV>   →   .env   (fallback)
```

> ⚠️ Because `.env` is the fallback for every environment, a key you forget to set
> in `.env.production` falls back to its `.env` value and gets baked into the
> production artifact. Set every key explicitly in the environment-specific file
> when the value must differ.

### gradle (`buildNodeBackend`)

The marketplace plugin zip's `backend.mjs` is built by gradle's `buildNodeBackend`
task, NOT by `build.sh`. It must replicate the same loading, so `build.gradle.kts`
(`loadBuildEnv`) parses the root `.env`, takes only `_`-prefixed keys, and injects
them (plus `BUILD_INJECT_KEYS`) into the esbuild task's environment. **If this is
missing, the shipped bundle has empty secrets even though `build.sh be-build`
looks fine** — this was a real bug, fixed in v0.19.3.

## How each target receives

| Target | Mechanism | Filter |
|--------|-----------|--------|
| **Node backend** | esbuild `define` | only `_`-prefixed keys (via `BUILD_INJECT_KEYS`) |
| **WebView** | vite `loadEnv` reads `process.env` | only `VITE_` / `CCG_PUBLIC_` keys |
| **Kotlin plugin** | not injected — Node is the sole backend | — |

esbuild replaces each `process.env._KEY` expression with its literal value at
build time, so the identifier disappears from the bundle. WebView code reads its
values as `import.meta.env.VITE_KEY`.

## Secret boundary

Three prefixes, three meanings:

| Prefix | Baked into | Browser-exposed? |
|--------|-----------|------------------|
| `_` | backend bundle | **No** — vite ignores it |
| `VITE_` / `CCG_PUBLIC_` | backend + webview bundle | **Yes** |
| (none) | nothing (runtime-only) | n/a |

Never give a secret a `VITE_` / `CCG_PUBLIC_` prefix. A `_`-prefixed secret is
safe: vite's `loadEnv` never picks it up, so it can't reach the browser.

## Build environments

`scripts/build.sh` resolves one `BUILD_ENV` per invocation (also used as vite's
`mode`) and selects which environment file is layered on:

| `BUILD_ENV` | Commands | File |
|-------------|----------|------|
| `production` | `dist`, `build-plugin` | `.env.production` |
| `staging` | `run-ide`, `run-ide-installed` | `.env.staging` |
| `development` | everything else | `.env.development` |

An explicit `BUILD_ENV` in the caller's environment always wins (e.g. `release.sh`
exports `BUILD_ENV=production` so the direct `gradlew verifyPlugin/publishPlugin`
calls resolve production too):

```bash
BUILD_ENV=production bash ./scripts/build.sh be-build
```

gradle's `loadBuildEnv` defaults to `production` when `BUILD_ENV` is unset, since
plugin artifacts are production by default.

## File tracking

`.gitignore` ignores every real env file and tracks only the template:

```
.env       .env.*       (ignored)
.env.example            (tracked)
```

## Adding a new value

### Backend, baked in at build time (secret / build-fixed)

1. Name it with a leading underscore in `.env.example`: `_YOUR_KEY=`.
2. Read it in `backend/src/config/environment.ts` as
   `export const YOUR_KEY = process.env._YOUR_KEY ?? ''` (static access).
3. Import `YOUR_KEY` from there; never touch `process.env` elsewhere.
4. Put the real value in your local `.env` (and `.env.production` / `.env.staging`
   as needed). Never commit it.

### Backend, runtime-injected (launcher-provided)

1. Use a plain name (no underscore) — it must NOT be baked in.
2. Read it in `environment.ts` as `process.env.YOUR_KEY`.
3. Ensure the launcher injects it (Kotlin `NodeProcessManager` / `ccg`).

### WebView value (public)

1. Name it with a `VITE_` or `CCG_PUBLIC_` prefix.
2. Document it in `.env.example`.
3. Read it via `webview/src/config/environment.ts` / `import.meta.env.VITE_YOUR_FLAG`.
4. Remember: prefixed values are **public** — never a secret.

## Verifying injection

An injected value is replaced inline by the bundler, so the original
`process.env._KEY` identifier disappears from the output. Confirm by searching for
the value (not the identifier) in the built bundle:

```bash
# Do not print secret values to shared logs.
bash ./scripts/build.sh be-build
grep -cF "$(grep '^_CCG_RYBBIT_API_KEY=' .env | cut -d= -f2-)" backend/dist/backend.mjs
# → 1 means the value was injected
```
